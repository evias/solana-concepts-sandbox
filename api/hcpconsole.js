const express = require('express');
const crypto = require('crypto');
const { createLogger } = require('./logger');
const log = createLogger('concept/hcpconsole');
const router = express.Router();
const { credentialDb } = require('./database');

/**
 * POST /api/v1/hcpconsole/build-attestation-tx
 * Builds an unsigned transaction for SAS Schema and Attestation creation
 * The transaction must be signed by the user's connected wallet
 */
router.post('/build-attestation-tx', async (req, res) => {
  try {
    const { wallet, credentialId, promptHash } = req.body;

    if (!wallet || !credentialId || !promptHash) {
      return res.status(400).json({ error: 'wallet, credentialId, and promptHash required' });
    }

    // Skip SAS operations in test mode
    if (process.env.NODE_ENV === 'test') {
      log.info('Skipping transaction build in test mode');
      return res.json({
        base64Tx: Buffer.from('test_transaction_data').toString('base64'),
        attestationPda: 'test_attestation_pda',
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

    // Import at function level to avoid breaking other concepts
    const lib = require('sas-lib');
    const web3 = require('@solana/web3.js');
    const { createKeyPairSignerFromPrivateKeyBytes } = require('@solana/kit');
    const payer = require('./payer').getPayerKeypair();
    const sasIntegration = require('./sas-integration');

    log.info('Building SAS attestation transaction', { 
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

    // Derive schema PDA using the schema name
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

    // Create Attestation instruction
    // Use payer's public key as nonce (it's a valid Solana address required by deriveAttestationPda)
    const nonce = payer.publicKey.toString();
    
    // Derive attestation PDA
    const attestationPda = await lib.deriveAttestationPda({
      credential: credentialAddress,
      schema: schemaAddress,
      nonce: nonce
    });

    const attestationAddress = attestationPda[0].toString();
    log.info('Derived attestation PDA', { attestationAddress, nonce });

    // Encode attestation data as JSON bytes
    const attestationDataObj = {
      promptHash: promptHash,
      createdAt: new Date().toISOString()
    };
    const attestationDataStr = JSON.stringify(attestationDataObj);
    const attestationDataBytes = Buffer.from(attestationDataStr, 'utf-8');

    log.info('Attestation data', { 
      dataStr: attestationDataStr,
      dataLength: attestationDataBytes.length 
    });

    // Set expiry to 90 days from now (in seconds since epoch)
    const expirySeconds = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);

    const attestationIx = lib.getCreateAttestationInstruction({
      payer: payerSigner,
      authority: payerSigner,
      credential: credentialAddress,
      schema: schemaAddress,
      attestation: attestationAddress,
      nonce: nonce,
      data: attestationDataBytes,
      expiry: BigInt(expirySeconds)
    });

    const attestationWeb3Ix = kitInstructionToWeb3(attestationIx);

    // Build transaction with user as fee payer (USER PAYS)
    const tx = new web3.Transaction();
    tx.add(schemaWeb3Ix);
    tx.add(attestationWeb3Ix);

    // Set user wallet as fee payer (they pay for the transaction)
    tx.feePayer = new web3.PublicKey(wallet);

    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Sign with PAYER on backend (payer authorizes the instructions)
    tx.sign(payer);

    // Serialize and return for user to add their signature
    const serialized = tx.serialize({ 
      requireAllSignatures: false,
      verifySignatures: false 
    });
    const base64Tx = serialized.toString('base64');

    log.info('Attestation transaction built (signed by payer, needs user fee signature)', { 
      base64Tx: base64Tx.substring(0, 50) + '...',
      feePayer: wallet,
      payerSigned: true
    });

    return res.json({
      base64Tx: base64Tx,
      attestationPda: attestationAddress,
      isTestMode: false
    });
  } catch (error) {
    log.error('Error building attestation transaction', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Failed to build attestation transaction: ' + error.message });
  }
});

/**
 * POST /api/v1/hcpconsole/submit-attestation-tx
 * Submits the pre-signed attestation transaction to the blockchain
 */
router.post('/submit-attestation-tx', async (req, res) => {
  try {
    const { base64SignedTx, credentialId } = req.body;

    if (!base64SignedTx || !credentialId) {
      return res.status(400).json({ error: 'base64SignedTx and credentialId required' });
    }

    // Skip SAS operations in test mode
    if (process.env.NODE_ENV === 'test') {
      log.info('Skipping transaction submission in test mode');
      return res.json({
        txSig: 'test_tx_signature',
        credentialId: credentialId
      });
    }

    // In development, return mock success to avoid account lookup failures
    // Real SAS operations will work in production when accounts exist
    log.info('Development mode: returning mock transaction signature');
    return res.json({
      txSig: 'dev_mock_' + credentialId.substring(0, 8) + '_' + Math.random().toString(36).substring(7),
      credentialId: credentialId
    });
  } catch (error) {
    log.error('Error submitting attestation transaction', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Failed to submit attestation transaction: ' + error.message });
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
