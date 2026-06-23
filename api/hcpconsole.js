const express = require('express');
const crypto = require('crypto');
const { createLogger } = require('./logger');
const log = createLogger('concept/hcpconsole');
const router = express.Router();
const { credentialDb } = require('./database');

/**
 * POST /api/v1/hcpconsole/build-attestation-tx
 * Creates schema (if needed) and attestation on Solana Attestation Service
 * Backend payer pays for all transactions
 */
router.post('/build-attestation-tx', async (req, res) => {
  try {
    const { wallet, credentialId, promptHash } = req.body;

    if (!wallet || !credentialId || !promptHash) {
      return res.status(400).json({ error: 'wallet, credentialId, and promptHash required' });
    }

    // Skip SAS operations in test mode
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
    const allCredentials = credentialDb.getAllCredentials(1000, 0);
    const credentialUuid = extractCredentialUuid(credentialId);
    const credential = allCredentials.find(cred => {
      const sasUuid = extractCredentialUuid(cred.sas_credential_id);
      const idUuid = extractCredentialUuid(cred.id);
      return sasUuid === credentialUuid || idUuid === credentialUuid;
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

    log.info('Creating attestation', { 
      credentialId: credential.id,
      owner: credential.wallet_address,
      promptHash: promptHash,
      feePayer: payer.publicKey.toBase58(),
    });

    // Create payer signer first (needed for all operations)
    const backendSigner = await createKeyPairSignerFromPrivateKeyBytes(
      new Uint8Array(payer.secretKey.slice(0, 32))
    );
    const ownerAddr = credential.wallet_address;

    // // Owner signer is the same as payer in this case (backend controls everything)
    // const ownerSigner = payerSigner;

    // Initialize RPC
    const rpc = createSolanaRpc('https://api.devnet.solana.com');

    // Step 1: Derive SAS credential PDA directly (no backwards compatibility)
    // Use credentialId to derive a unique credential name
    const sasCredentialName = crypto.createHash('sha256').update(credential.sas_credential_id).digest().toString('hex').substring(0, 32);
    const [credentialPda] = await lib.deriveCredentialPda({
      authority: payer.publicKey.toBase58(),
      name: sasCredentialName
    });

    const credentialAddress = credentialPda.toString();
    log.info('SAS credential PDA derived', { 
      credentialAddress,
      sasCredentialName
    });

    // Verify credential exists on-chain
    let credentialAccount = await lib.fetchMaybeCredential(rpc, credentialPda);
    if (!credentialAccount || credentialAccount.exists === false) {
      log.info('SAS credential does not exist, creating it...');
      const createCredentialIx = lib.getCreateCredentialInstruction({
        payer: backendSigner,
        authority: backendSigner,
        credential: credentialPda,
        name: sasCredentialName,
        signers: []
      });

      const credentialWeb3Ix = await sasIntegration.kitInstructionToWeb3(createCredentialIx);
      const credentialSig = await sasIntegration.sendTransaction(credentialWeb3Ix, payer);
      log.info('SAS credential created successfully', { credentialPda, txSig: credentialSig });
    } else {
      log.info('SAS credential already exists', { credentialPda });
    }

    // Step 2: Ensure schema exists for this credential
    const schemaName = 'HCP-Prompt-Verification';
    const fieldNames = ['promptHash'];
    const schemaVersion = 1;

    const [schemaPda] = await lib.deriveSchemaPda({
      credential: credentialPda,
      name: schemaName,
      version: schemaVersion
    });

    const schemaAddress = schemaPda.toString();
    log.info('Schema address derived', { schemaPda, schemaAddress });

    // Fetch schema to verify it exists
    let schemaAccount = await lib.fetchMaybeSchema(rpc, schemaPda);
    if (!schemaAccount || schemaAccount.exists === false) {
      log.info('Schema does not exist, creating it...', {
        credentialAddress,
        schemaAddress,
        schemaName,
        fieldNames
      });
      // promptHash is 32 bytes (SHA256)
      const layout = Buffer.from([32]);
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
      log.info('Schema web3 instruction built', {
        programId: schemaWeb3Ix.programId.toString(),
        keyCount: schemaWeb3Ix.keys.length,
        keys: schemaWeb3Ix.keys.map((key, idx) => ({
          idx,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable
        })),
        dataLength: schemaWeb3Ix.data.length
      });

      try {
        const schemaSig = await sasIntegration.sendTransaction(schemaWeb3Ix, payer);
        log.info('Schema created successfully', { schemaAddress, txSig: schemaSig });
      } catch (e) {
        if (e.getLogs !== undefined) {
          log.error('Error creating schema', e.getLogs());
        } else  {
          log.error('Error creating schema (unknown)', e);
        }
      }
    } else {
      log.info('Schema already exists', { schemaAddress });
    }

    // Step 3: Create deterministic nonce from credentialId + promptHash
    const nonceInput = credentialId + promptHash;
    const nonceHash = crypto.createHash('sha256').update(nonceInput).digest();
    const nonceKeypair = web3.Keypair.fromSeed(new Uint8Array(nonceHash.slice(0, 32)));
    const nonce = nonceKeypair.publicKey.toString();
    log.info('Nonce derived', { nonce });

    // Step 4: Derive attestation PDA
    const [attestationPda] = await lib.deriveAttestationPda({
      credential: credentialPda,
      schema: schemaPda,
      nonce: nonce
    });

    const attestationAddress = attestationPda.toString();
    log.info('Attestation address derived', { attestationAddress });

    // Step 5: Prepare attestation data
    const attestationDataObj = {
      promptHash: promptHash,
      createdAt: new Date().toISOString()
    };
    const attestationDataStr = JSON.stringify(attestationDataObj);
    const attestationDataBytes = Buffer.from(attestationDataStr, 'utf-8');
    log.info('Attestation data prepared', { dataLength: attestationDataBytes.length });

    // Step 6: Set expiry
    const expirySeconds = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);

    // Step 7: Create attestation instruction (same pattern as addAuthorizedSigner)
    const attestationIx = lib.getCreateAttestationInstruction({
      payer: payerSigner,
      authority: ownerSigner,
      credential: credentialPda,
      schema: schemaPda,
      attestation: attestationPda,
      //systemProgram: '11111111111111111111111111111111',
      nonce: nonce,
      data: attestationDataBytes,
      expiry: BigInt(expirySeconds)
    });

    log.info('Attestation instruction created', {
      accounts: attestationIx.accounts.length,
      dataLength: attestationIx.data.length
    });

    // Step 8: Convert and send (same pattern as everywhere else)
    const attestationWeb3Ix = await sasIntegration.kitInstructionToWeb3(attestationIx);
    const attestationSig = await sasIntegration.sendTransaction(attestationWeb3Ix, payer);

    log.info('Attestation created successfully', { 
      txSig: attestationSig, 
      attestationAddress, 
      credentialAddress,
      schemaAddress 
    });

    return res.json({
      txSig: attestationSig,
      credentialId: credentialId,
      attestationAddress: attestationAddress,
      schemaAddress: schemaAddress,
      isTestMode: false
    });
  } catch (error) {
    log.error('Error creating attestation', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Failed to create attestation: ' + error.message });
  }
});

/**
 * POST /api/v1/hcpconsole/submit-attestation-tx
 * No longer used - deprecated
 */
router.post('/submit-attestation-tx', async (req, res) => {
  return res.json({
    message: 'Attestation creation is now synchronous. Use /build-attestation-tx which returns txSig directly.',
    note: 'This endpoint is deprecated'
  });
});

/**
 * Helper: Extract UUID from credential ID
 */
function extractCredentialUuid(credentialId) {
  if (!credentialId) return null;
  const parts = credentialId.split('_');
  return parts.length > 1 ? parts[1] : credentialId;
}

module.exports = router;
