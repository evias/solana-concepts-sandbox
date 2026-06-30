const express = require('express');
const crypto = require('crypto');
const config = require('./config');
const { createLogger } = require('./logger');
const log = createLogger('concept/hcpconsole');
const router = express.Router();
const { credentialDb, hcpConsoleDb } = require('./database');

const cipher_algo = config.cipher.algorithm;

/**
 * Helper: Encrypt text using AES and a configured encryption key.
 */
function encrypt(message) {
  try {
    const secretKey = require('./cipher').getCipherKey();
    if (secretKey.length != 32) {
      throw new Error(`Expected encryption key size of 32 bytes; got: ${secretKey.length}b`);
    }

    const iv = crypto.randomBytes(16); // random 16b IV
    const cipher = crypto.createCipheriv(cipher_algo, secretKey, iv);

    let ciphertext = cipher.update(message, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      ciphertext,
    };
   } catch (error) {
     log.error('Error encrypting message', { error: error.message });
     return null;
   }
}

/**
 * Helper: Decrypt text using AES and a configured encryption key.
 */
function decrypt(cipherObj) {
  try {
    if (!cipherObj || !cipherObj.iv || !cipherObj.ciphertext) {
      throw new Error(`Invalid encrypted payload, must contain fields: iv, ciphertext.`);
    }

    const secretKey = require('./cipher').getCipherKey();
    if (secretKey.length != 32) {
      throw new Error(`Expected encryption key size of 32 bytes; got: ${secretKey.length}b`);
    }

    const decipher = crypto.createDecipheriv(
      cipher_algo,
      secretKey,
      Buffer.from(cipherObj.iv, 'hex')
    );

    let message = decipher.update(cipherObj.ciphertext, 'hex', 'utf8');
    message += decipher.final('utf8');
    return message;
  } catch (error) {
     log.error('Error decrypting message', { error: error.message });
     return null;
   }
}

/**
 * @swagger
 * /api/v1/hcpconsole/build-attestation-tx:
 *   post:
 *     tags:
 *       - HCPConsole
 *     summary: Create a patient journey with provider attested AI prompt.
 *     description: Creates an AI prompt for a patient journey which is SAS attested by a provider.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet
 *               - credentialId
 *               - caseRef
 *               - promptHash
 *               - promptText
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: Solana wallet address
 *               credentialId:
 *                 type: string
 *                 description: Credential sasCredentialId
 *               caseRef:
 *                 type: string
 *                 description: Reference of the case
 *               promptHash:
 *                 type: string
 *                 description: SHA256 hash of the AI prompt
 *               promptText:
 *                 type: string
 *                 description: AI prompt content
 *     responses:
 *       200:
 *         description: Prompt attestation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 file:
 *                   type: object
 *                   properties:
 *                     txSig: { type: string }
 *                     credentialPda: { type: string }
 *                     schemaPda: { type: string }
 *                     attestationPda: { type: string }
 *                     isTestMode: { type: boolean }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied - wallet not authorized for credential
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/build-attestation-tx', async (req, res) => {
  try {
    const { wallet, credentialId, caseRef, promptHash, promptText } = req.body;

    if (!wallet || !credentialId || !caseRef || !promptHash || !promptText) {
      return res.status(400).json({ error: 'wallet, credentialId, caseRef, promptHash, and promptText required' });
    }

    const ownerAddress = wallet;

    // Skip SAS operations in test mode
	  // XXX changed return format
    if (process.env.NODE_ENV === 'test') {
      log.info('Skipping attestation creation in test mode');
      return res.json({
        txSig: 'test_tx_signature_' + credentialId.substring(0, 8),
        credentialId: credentialId,
        attestationAddress: 'test_attestation_pda_' + promptHash.substring(0, 8),
        schemaAddress: 'test_schema_pda',
        isTestMode: true
      });
    }

    // Find the credential
    const allCredentialsByWallet = credentialDb.getCredentialsByWallet(ownerAddress, 50, 0);
    const credential = allCredentialsByWallet.find(cred => {
      return cred.sas_credential_id === credentialId;
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    // Check access - wallet must be the credential owner
    const hasAccess = credential.wallet_address === wallet;
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: wallet not authorized for this credential' });
    }

    // Import modules (same pattern as carecircle)
    const lib = require('sas-lib');
    const web3 = require('@solana/web3.js');
    const { createKeyPairSignerFromPrivateKeyBytes, createSolanaRpc } = require('@solana/kit');
    const payer = require('./payer').getPayerKeypair();
    const sasIntegration = require('./sas-integration');

    // Initialize RPC connection ("fetchMaybeX").
    const rpc = createSolanaRpc('https://api.devnet.solana.com');
    const COMPUTE_BUDGET_PROGRAM = new web3.PublicKey('ComputeBudget111111111111111111111111111111');

    log.info('Creating attestation', { 
      credentialId: credential.id,
      sasCredentialId: credential.sas_credential_id,
      owner: credential.wallet_address,
      promptHash: promptHash,
      feePayer: payer.publicKey.toBase58(),
    });

    // 1: Create payer signer first (needed for all operations)
    const backendSigner = await createKeyPairSignerFromPrivateKeyBytes(
      new Uint8Array(payer.secretKey.slice(0, 32))
    );

    // 2: Derive credential PDA 
    // Use credentialId to derive a unique credential name
    const sasCredentialName = crypto.createHash('sha256').update(
      credential.sas_credential_id
    ).digest().toString('hex').substring(0, 32);

    const [credentialPda] = await lib.deriveCredentialPda({
      authority: payer.publicKey.toBase58(),
      name: sasCredentialName
    });
    log.info('Credential PDA derived', { credentialPda, sasCredentialName });

    // 3: Derive attestation schema PDA
    const schemaName = 'HCP-Prompt-Verification';
    const fieldNames = ['promptHash'];
    const schemaVersion = 1;

    const [schemaPda] = await lib.deriveSchemaPda({
      credential: credentialPda,
      name: schemaName,
      version: schemaVersion
    });
    log.info('Schema PDA derived', { schemaPda });

    // 4: Derive attestation PDA
    // Create deterministic nonce from credentialId + promptHash
    const nonceInput = credentialId + promptHash;
    const nonceHash = crypto.createHash('sha256').update(nonceInput).digest();
    const nonceKeypair = web3.Keypair.fromSeed(new Uint8Array(nonceHash.slice(0, 32)));
    const nonce = nonceKeypair.publicKey.toString();
    log.info('Nonce derived', { nonce });

    const [attestationPda] = await lib.deriveAttestationPda({
      credential: credentialPda,
      schema: schemaPda,
      nonce: nonce
    });
    log.info('Attestation PDA derived', { attestationPda });

    // 5: Ensure SAS credential exists and get its actual on-chain address
    log.info(`Ensuring SAS credential for wallet ${wallet} and id ${credential.sas_credential_id}...`);
    const { credentialAddress, transactionSignature: credentialTxSig } = await sasIntegration.ensureSasCredential(
      ownerAddress,
      payer,
      credential.sas_credential_id
    );
    log.info(`SAS credential retrieved with address: ${credentialAddress}`);

    // 6: If SAS schema doesn't exist on-chain, add instruction.
    let schemaTxSig = null;
    let schemaAccount = await lib.fetchMaybeSchema(rpc, schemaPda);
    if (!schemaAccount || schemaAccount.exists === false) {
      // promptHash is 32 bytes (SHA256)
      const layout = Buffer.from([12]);
      const schemaIx = lib.getCreateSchemaInstruction({
        payer: backendSigner,
        authority: backendSigner,
        credential: credentialPda,
        schema: schemaPda,
        layout: layout,
        fieldNames: fieldNames,
        name: schemaName,
        description: 'Prompt integrity verification schema',
      });

      const schemaWeb3Ix = await sasIntegration.kitInstructionToWeb3(schemaIx);
      log.info('Created SAS Schema Instruction', { schemaWeb3Ix });

      schemaTxSig = await sasIntegration.sendTransaction(schemaWeb3Ix, payer, false); // false=setFeePayer
      log.info('Confirmed SAS Schema Tx', { schemaTxSig });

      // ... and fetch the schema
      schemaAccount = await lib.fetchSchema(rpc, schemaPda);
    }

    // 7: Create the expirable attestation using correct schema (populate). 
    const expirySeconds = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // XXX 90 days ("next consultation")
    const attestationIx = lib.getCreateAttestationInstruction({
      payer: backendSigner,
      authority: backendSigner,
      credential: credentialPda,
      schema: schemaPda,
      attestation: attestationPda,
      nonce: nonce,
      data: lib.serializeAttestationData(schemaAccount.data, {
        promptHash: promptHash,
      }),
      expiry: BigInt(expirySeconds)
    });

    const attestationWeb3Ix = await sasIntegration.kitInstructionToWeb3(attestationIx);

    const attestationTxSig = await sasIntegration.sendTransaction(attestationWeb3Ix, payer, false); // false=setFeePayer
    log.info('Confirmed SAS Attestation Tx', { attestationTxSig });

    // Create hcp_prompts record in database
    log.info('Creating hcp_prompts record', {wallet: credential.wallet_address});
    let hcp_prompts_row;
    const promptId = `hcpp_${uuidv4()}`;
    promptPayload = encrypt(promptText); // encrypt using AES
    hcp_prompts_row = hcpConsoleDb.createPrompt({
      id: promptId,
      walletAddress: credential.wallet_address,
      sasCredentialId: credential.sas_credential_id,
      promptHash,
      promptCipher: promptPayload.ciphertext,
      promptIV: promptPayload,iv,
      caseRef,
      transactionSignature: attestationTxSig,
    });

    return res.status(200).json({
      success:true,
      txSig: attestationTxSig,
      credentialPda,
      schemaPda,
      attestationPda,
      isTestMode: false,
    });
  } catch (error) {
    if ("getLogs" in error && typeof error.getLogs !== undefined) {
      log.error('Error creating attestation', { error: error, logs: error.getLogs() });
    } else {
      log.error('Error creating attestation', { error: error.message, stack: error.stack });
    }
    return res.status(500).json({ error: 'Failed to create attestation: ' + error.message });
  }
});

/**
 * @swagger
 * /api/v1/hcpconsole/prompt:
 *   get:
 *     tags:
 *       - HCPConsole
 *     summary: Retrieve hcp_prompts.prompt_cipher in plaintext by case_ref
 *     description: Retrieves hcp_prompts.prompt_cipher in plaintext by case_ref.
 *     responses:
 *       200:
 *         description: Prompt retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prompt:
 *                   type: string
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/prompt', (req, res) => {
  const { caseRef } = req.query;
  if (!caseRef) {
    return res.status(402).json({ error: 'Invalid Request' });
  }

  const hcpPrompt = hcpConsoleDb.getPromptByCaseRef(caseRef);
  if (!hcpPrompt || !hcpPrompt.cipher_iv || !hcpPrompt.prompt_cipher) {
    return res.status(404).json({ error: 'Not Found' });
  }

  const cleartextPrompt = decrypt({
    iv: hcpPrompt.cipher_iv,
    ciphertext: hcpPrompt.prompt_cipher
  });

  if (!cleartextPrompt) {
    return res.status(500).json({ error: 'Decryption failed: unknown error' });
  } 

  return res.status(200).json({
    prompt: cleartextPrompt,
  });
});

module.exports = router;
