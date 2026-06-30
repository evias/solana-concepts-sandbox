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
