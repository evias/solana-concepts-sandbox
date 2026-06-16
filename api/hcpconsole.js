const express = require('express');
const crypto = require('crypto');
const { createLogger } = require('./logger');
const log = createLogger('concept/hcpconsole');
const router = express.Router();
const { credentialDb } = require('./database');

/**
 * POST /api/v1/hcpconsole/create-attestation
 * Creates a SAS Schema and Attestation for an HCP Console prompt
 */
router.post('/create-attestation', async (req, res) => {
  try {
    const { wallet, credentialId, promptHash } = req.body;

    if (!wallet || !credentialId || !promptHash) {
      return res.status(400).json({ error: 'wallet, credentialId, and promptHash required' });
    }

    // Skip SAS operations in test mode
    if (process.env.NODE_ENV === 'test') {
      log.info('Skipping attestation creation in test mode');
      return res.json({
        attPda: 'test_attestation_pda',
        txSig: 'test_tx_signature'
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

    // Check access
    const hasAccess = credential.wallet_address === wallet;
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: wallet not authorized for this credential' });
    }

    // Import at function level to avoid breaking other concepts
    const lib = require('sas-lib');
    const web3 = require('@solana/web3.js');
    const { createSolanaRpc, createKeyPairSignerFromPrivateKeyBytes } = require('@solana/kit');
    const payer = require('./payer').getPayerKeypair();
    const sasIntegration = require('./sas-integration');

    const rpc = createSolanaRpc('https://api.devnet.solana.com');

    log.info('Creating SAS Schema and Attestation', { 
      credentialId: credential.id,
      owner: credential.wallet_address,
      promptHash: promptHash
    });

    // Get or create the SAS credential address
    const sasResult = await sasIntegration.ensureSasCredential(
      credential.wallet_address, 
      payer, 
      credential.sas_credential_id
    );

    const credentialAddress = sasResult.credentialAddress;
    log.info('Using SAS credential address', { credentialAddress });

    // 1. Derive schema PDA using the schema name
    const schemaName = 'Prompt Verification';
    const fieldNames = ['promptHash'];
    const schemaVersion = 0;

    const payerSigner = await createKeyPairSignerFromPrivateKeyBytes(
      new Uint8Array(payer.secretKey.slice(0, 32))
    );

    // Derive schema PDA
    const schemaPda = await lib.deriveSchemaPda({
      credential: credentialAddress,
      name: schemaName,
      version: schemaVersion
    });

    const schemaAddress = schemaPda[0].toString();
    log.info('Derived schema PDA', { schemaAddress });

    // Create the schema instruction
    const schemaIx = lib.getCreateSchemaInstruction({
      payer: payerSigner,
      authority: payerSigner,
      credential: credentialAddress,
      schema: schemaAddress,
      name: schemaName,
      description: '',
      layout: Buffer.from([]),
      fieldNames: fieldNames
    });

    // Convert to web3.js transaction
    function roleToWeb3Account(address, role) {
      return {
        pubkey: new web3.PublicKey(address),
        isSigner: role >= 2,
        isWritable: role === 1 || role === 3
      };
    }

    function kitInstructionToWeb3(kitIx) {
      return new web3.TransactionInstruction({
        keys: kitIx.accounts.map(acc => roleToWeb3Account(acc.address, acc.role)),
        programId: new web3.PublicKey(kitIx.programAddress),
        data: Buffer.from(kitIx.data)
      });
    }

    const schemaWeb3Ix = kitInstructionToWeb3(schemaIx);

    // 2. Create Attestation instruction
    const attestationData = {
      promptHash: promptHash
    };

    const attestationIx = lib.getCreateAttestationInstruction({
      payer: payerSigner,
      authority: payerSigner,
      credential: credentialAddress,
      schema: schemaAddress,
      data: attestationData
    });

    const attestationWeb3Ix = kitInstructionToWeb3(attestationIx);

    // Send both transactions
    const tx = new web3.Transaction();
    tx.add(schemaWeb3Ix);
    tx.add(attestationWeb3Ix);

    // Serialize and partially sign
    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    tx.sign(payer);

    // Send transaction
    const serialized = tx.serialize({ requireAllSignatures: false });
    const txSig = await connection.sendRawTransaction(serialized);

    log.info('Attestation transaction sent', { txSig: txSig });

    return res.json({
      attPda: schemaAddress,
      txSig: txSig,
      credentialId: credential.id
    });
  } catch (error) {
    log.error('Error creating attestation', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Failed to create attestation: ' + error.message });
  }
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
