/**
 * HealthCred API Routes
 * 
 * Manages healthcare worker credentials, badges, and certifications
 * Integrates with SAS (Solana Attestation Service) for credential creation
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const web3 = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } = require('@solana/spl-token');
const { payer } = require('./payer');
const { credentialDb, badgeDb, certificationDb } = require('./database');
const { createLogger } = require('./logger');
const log = createLogger('concept/healthcred');

const router = express.Router();
const connection = new web3.Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
const MEMO_PROGRAM_ID = new web3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const COMPUTE_BUDGET_PROGRAM = new web3.PublicKey('ComputeBudget111111111111111111111111111111');

/**
 * POST /register
 * Register a new healthcare worker credential
 * 
 * Body:
 * {
 *   walletAddress: string (currently connected wallet),
 *   fullName: string,
 *   dateOfBirth: string (YYYY-MM-DD),
 *   email: string,
 *   profession: string,
 *   didDocumentJson: string (JSON stringified DID document)
 * }
 * 
 * Returns: Credential object with on-chain transaction details
 */
/**
 * @swagger
 * /api/v1/healthcred/register-start:
 *   post:
 *     tags:
 *       - HealthCred
 *     summary: Prepare credential registration
 *     description: Prepares an unsigned transaction for healthcare worker credential registration. User signs the transaction with their wallet, then submits to /register-verify endpoint.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *               - fullName
 *               - dateOfBirth
 *               - email
 *               - profession
 *               - didDocumentJson
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Currently connected Solana wallet address
 *               fullName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: Format YYYY-MM-DD
 *               email:
 *                 type: string
 *               profession:
 *                 type: string
 *               didDocumentJson:
 *                 type: string
 *                 description: JSON stringified DID document
 *     responses:
 *       200:
 *         description: Registration prepared - user should sign the transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 registrationId: { type: string }
 *                 transaction: { type: string, description: "Base64 encoded unsigned transaction" }
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     walletAddress: { type: string }
 *                     fullName: { type: string }
 *                     profession: { type: string }
 *                     message: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/register', async (req, res) => {
  try {
    const { walletAddress, fullName, dateOfBirth, email, profession, didDocumentJson } = req.body;
    
    log.info('Received registration request');
    log.info('Wallet:', { walletAddress });
    log.info('Full Name:', { fullName });
    log.info('Profession:', { profession });
    log.info('Email:', { email });
    
    // Validate required fields
    if (!walletAddress || !fullName || !dateOfBirth || !email || !profession || !didDocumentJson) {
      log.info('Validation failed: Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      log.info('Validation failed: Invalid wallet address format');
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    // Validate DID document (no longer checking for duplicate wallet addresses)
    // A wallet can have multiple credentials; uniqueness is on did_document_hash
    log.info('Validating DID document...');
    let didDoc;
    try {
      didDoc = JSON.parse(didDocumentJson);
    } catch (err) {
      log.info('DID document parsing failed:', { err });
      return res.status(400).json({ error: 'Invalid DID Document JSON' });
    }
    
    if (!didDoc.id || typeof didDoc.id !== 'string') {
      log.info('DID document missing valid id field');
      return res.status(400).json({ error: 'DID Document must contain valid "id" field' });
    }
    
    if (!Array.isArray(didDoc.authentication)) {
      log.info('DID document missing authentication array');
      return res.status(400).json({ error: 'DID Document must contain "authentication" array' });
    }
    
    log.info('DID ID:', { didDoc });
    log.info('Authentication methods:', { didDoc });
    
     // Calculate SHA2-256 hash of DID document
     log.info('Calculating DID document hash...');
     const didDocumentHash = crypto
       .createHash('sha256')
       .update(didDocumentJson)
       .digest('hex');
     log.info('DID document hash:', { didDocumentHash });
     
     // Note: NFT Mint and token account creation will happen after user signs the transaction
     // This avoids TokenAccountNotFoundError during background processing
     const userPublicKey = new web3.PublicKey(walletAddress);
    
    // Create unsigned transaction with user as fee payer (2-step: user signs in Phantom)
    log.info('Creating unsigned transaction for user to sign...');
    const transaction = new web3.Transaction();
    
    // Add compute budget instruction (300k for large DID docs)
    const computeBudgetInstruction = new web3.TransactionInstruction({
      programId: COMPUTE_BUDGET_PROGRAM,
      keys: [],
      data: Buffer.concat([
        Buffer.from([0x02]), // SetComputeUnitLimit instruction discriminator
        Buffer.alloc(4) // 4 bytes buffer for compute units
      ])
    });
    computeBudgetInstruction.data.writeUInt32LE(300000, 1);
    transaction.add(computeBudgetInstruction);
    
    // Add memo instruction with DID document
    log.info('Adding memo instruction with DID document (', { didDocumentJson });
    const memoBuffer = Buffer.from(didDocumentJson, 'utf8');
    transaction.add(
      new web3.TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: memoBuffer
      })
    );
    
    // Get recent blockhash
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    log.info('Recent blockhash:', { blockhash });
    
    // Set user wallet as fee payer (user pays for transaction)
    transaction.feePayer = userPublicKey;
    log.info('Set transaction fee payer to user wallet:', { userPublicKey });
    
    // Serialize unsigned transaction for user to sign via Phantom
    let serializedTx;
    try {
      log.info('Serializing unsigned transaction for user to sign...');
      serializedTx = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });
      log.info('Unsigned transaction serialized, size:', { serializedTx });
    } catch (err) {
      log.error('Error serializing transaction:', { error: err });
      log.error('Error stack:', { error: err });
      return res.status(500).json({ error: 'Failed to prepare transaction for signing', details: err.message });
    }
    const base64Tx = serializedTx.toString('base64');
    
     // Store temporary registration data (expires in 15 minutes)
     const registrationId = uuidv4();
     const registrationData = {
       walletAddress,
       fullName,
       dateOfBirth,
       email,
       profession,
       didDocumentJson,
       didDocumentHash,
       didId: didDoc.id,
       authenticationMethods: didDoc.authentication,
       blockhash: blockhash.blockhash,
       lastValidBlockHeight: blockhash.lastValidBlockHeight,
       timestamp: Date.now()
     };
    
    // In production, store in Redis or similar. For now, store in memory with TTL
    if (!global.healthCredRegistrations) {
      global.healthCredRegistrations = {};
    }
    global.healthCredRegistrations[registrationId] = registrationData;
    
    // Set TTL (15 minutes) - use unref() so it doesn't keep process alive
    const cleanupTimer = setTimeout(() => {
      delete global.healthCredRegistrations[registrationId];
      log.info('Cleaned up expired registration:', { registrationId });
    }, 15 * 60 * 1000);
    cleanupTimer.unref();
    
    log.info('Registration prepared, waiting for user signature');
    
     return res.status(200).json({
       success: true,
       registrationId,
       transaction: base64Tx,
       metadata: {
         walletAddress,
         fullName,
         profession,
         message: 'Sign this transaction with your wallet to complete registration'
       }
     });
  } catch (error) {
    log.error('Registration preparation error:', { error: error });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * @swagger
 * /api/v1/healthcred/register-verify:
 *   post:
 *     tags:
 *       - HealthCred
 *     summary: Submit signed registration transaction
 *     description: Completes credential registration by submitting a user-signed transaction. Creates NFT mint and stores credential record in database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - registrationId
 *               - signedTransaction
 *             properties:
 *               registrationId:
 *                 type: string
 *                 description: From /register-start response
 *               signedTransaction:
 *                 type: string
 *                 description: Base64 signed transaction from user's wallet
 *     responses:
 *       200:
 *         description: Registration completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 credential:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     wallet_address: { type: string }
 *                     full_name: { type: string }
 *                     profession: { type: string }
 *                     did_id: { type: string }
 *                     created_at: { type: string }
 *                 onChain:
 *                   type: object
 *                   properties:
 *                     mint: { type: string }
 *                     transactionSignature: { type: string }
 *                     memoUrl: { type: string }
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     solscanUrl: { type: string }
 *                     didDocumentHash: { type: string }
 *                     sasCredentialId: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         description: Registration not found or expired
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/submit-signed-transaction', async (req, res) => {
  try {
    const { registrationId, signedTransaction } = req.body;
    
    log.info('Received signed transaction submission');
    log.info('Registration ID:', { registrationId });
    
    if (!registrationId || !signedTransaction) {
      return res.status(400).json({ error: 'Missing registrationId or signedTransaction' });
    }
    
    // Retrieve registration data
    if (!global.healthCredRegistrations || !global.healthCredRegistrations[registrationId]) {
      log.info('Registration not found or expired:', { registrationId });
      return res.status(404).json({ error: 'Registration not found or expired. Please create a new registration.' });
    }
    
    const regData = global.healthCredRegistrations[registrationId];
    log.info('Found registration for wallet:', { regData });
    
    // Deserialize and send transaction
    let transactionSignature = '';
    let transactionHash = '';
    try {
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      const transaction = web3.Transaction.from(txBuffer);
      
      log.info('Deserialized signed transaction');
      log.info('Sending transaction...');
      
      transactionSignature = await connection.sendRawTransaction(transaction.serialize());
      log.info('Transaction sent:', { transactionSignature });
      
      log.info('Confirming transaction...');
      await connection.confirmTransaction({
        signature: transactionSignature,
        blockhash: regData.blockhash,
        lastValidBlockHeight: regData.lastValidBlockHeight
      });
      transactionHash = transactionSignature;
      log.info('Transaction confirmed');
     } catch (err) {
       log.error('Error sending transaction:', { error: err });
       return res.status(500).json({ error: 'Failed to send transaction', details: err.message });
     }
     
     // Create NFT mint for this credential
     log.info('Creating NFT mint for credential...');
     let mintAddress = null;
     try {
       log.info('Creating SPL token mint...');
       const mint = await createMint(
         connection,
         payer,
         payer.publicKey,      // Mint authority (backend payer)
         payer.publicKey,      // Freeze authority (backend payer)
         0                     // 0 decimals = NFT
         );
         mintAddress = mint.toBase58();
         log.info('Token mint created:', { mintAddress });

         // Wait for RPC to index the mint (skip in test mode)
         if (process.env.NODE_ENV !== 'test') {
           await new Promise(resolve => setTimeout(resolve, 1000));
         }

         // Create associated token account for credential owner
        log.info('Creating associated token account...');
       const credentialOwnerPublicKey = new web3.PublicKey(regData.walletAddress);
       const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
         connection,
         payer,
         mint,
         credentialOwnerPublicKey
         );
         log.info('Token account created:', { associatedTokenAccount });

         // Wait for RPC to index the ATA (skip in test mode)
         if (process.env.NODE_ENV !== 'test') {
           await new Promise(resolve => setTimeout(resolve, 1000));
         }

         // Mint 1 token to represent this credential
        log.info('Minting credential token...');
       const mintSig = await mintTo(
         connection,
         payer,
         mint,
         associatedTokenAccount.address,
         payer,
         1
       );
       log.info('Token minted, signature:', { mintSig });
      } catch (mintErr) {
        log.error('Error creating NFT mint or minting:', { error: mintErr });
        log.error('Error stack:', { error: mintErr });
        log.error('Full error:', { error: mintErr });
        // If mint was created but something else failed, still keep the mint address
        // Only set to null if createMint itself failed
        if (!mintAddress) {
          return res.status(500).json({ error: 'Failed to create credential NFT', details: mintErr.message });
        }
      }
     
     // Create credential record in database
     log.info('Creating credential record in database...');
     const credentialId = `hc_${uuidv4()}`;
     let credential;
     try {
       credential = credentialDb.createCredential({
         id: credentialId,
         walletAddress: regData.walletAddress,
         fullName: regData.fullName,
         dateOfBirth: regData.dateOfBirth,
         email: regData.email,
         profession: regData.profession,
         didDocumentJson: regData.didDocumentJson,
         didDocumentHash: regData.didDocumentHash,
         didId: regData.didId,
         authenticationMethods: JSON.stringify(regData.authenticationMethods),
         sasCredentialId: `sas_${uuidv4()}`,    // Unique credential ID
         mintAddress,                           // NFT mint address (or null if creation failed)
         transactionSignature,
         transactionHash
       });
     } catch (dbErr) {
       log.error('Database error creating credential:', { error: dbErr });
       // Clean up registration data even if creation fails
       delete global.healthCredRegistrations[registrationId];
       return res.status(500).json({ error: 'Failed to save credential', details: dbErr.message });
     }
     
     // Clean up registration data
     delete global.healthCredRegistrations[registrationId];
     
     log.info('Registration completed!');
     log.info('Credential ID:', { credentialId });
     log.info('SAS ID:', { credential });
      if (mintAddress) {
        log.info('NFT Mint:', { mintAddress });
        log.info('Mint URL: https://solscan.io/token/' + mintAddress + '?cluster=devnet');
      }
      log.info('Transaction URL: https://solscan.io/tx/' + transactionHash + '?cluster=devnet');
     
     return res.status(200).json({
       success: true,
       credential: {
         id: credential.id,
         wallet_address: credential.wallet_address,
         full_name: credential.full_name,
         profession: credential.profession,
         did_id: credential.did_id,
         created_at: credential.created_at
       },
       onChain: {
         mint: mintAddress,
         transactionSignature,
         memoUrl: `https://solscan.io/tx/${transactionHash}?cluster=devnet`
       },
       metadata: {
         solscanUrl: `https://solscan.io/tx/${transactionHash}?cluster=devnet`,
         didDocumentHash: regData.didDocumentHash,
         sasCredentialId: credential.sas_credential_id
       }
     });
  } catch (error) {
    log.error('Signed transaction submission error:', { error: error });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * GET /credentials?limit=10&offset=0
 * Get all registered credentials with pagination
 */
router.get('/credentials', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const offset = parseInt(req.query.offset) || 0;
    
    if (limit < 1 || offset < 0) {
      return res.status(400).json({ error: 'Invalid limit or offset' });
    }
    
    const credentials = credentialDb.getAllCredentials(limit, offset);
    const total = credentialDb.getCredentialCount();
    
    // Remove sensitive DID document from list view but include all on-chain fields
    const sanitized = credentials.map(c => ({
      id: c.id,
      wallet_address: c.wallet_address,
      full_name: c.full_name,
      date_of_birth: c.date_of_birth,
      profession: c.profession,
      email: c.email,
      did_id: c.did_id,
      sas_credential_id: c.sas_credential_id,
      mint_address: c.mint_address,
      transaction_signature: c.transaction_signature,
      transaction_hash: c.transaction_hash,
      badges_count: 0, // Will be populated from badges table if needed
      created_at: c.created_at
    }));
    
    res.status(200).json({
      credentials: sanitized,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
   } catch (error) {
     log.error('Error fetching credentials', { error });
     res.status(500).json({ error: 'Internal server error' });
   }
});

/**
 * GET /credentials/:id
 * Get a specific credential by ID
 */
router.get('/credentials/:id', (req, res) => {
  try {
    const credential = credentialDb.getCredentialById(req.params.id);
    
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    // Remove DID document JSON from response (use /did/:didId for that)
    const badgeCount = (badgeDb.getBadgesByCredentialId(credential.id) || []).length;
    const sanitized = {
      id: credential.id,
      wallet_address: credential.wallet_address,
      full_name: credential.full_name,
      date_of_birth: credential.date_of_birth,
      profession: credential.profession,
      email: credential.email,
      did_id: credential.did_id,
      did_document_hash: credential.did_document_hash,
      sas_credential_id: credential.sas_credential_id,
      mint_address: credential.mint_address,
      transaction_signature: credential.transaction_signature,
      transaction_hash: credential.transaction_hash,
      created_at: credential.created_at,
      badges_count: badgeCount
    };
    
    res.status(200).json(sanitized);
   } catch (error) {
     log.error('Error fetching credential', { error });
     res.status(500).json({ error: 'Internal server error' });
   }
});

/**
 * GET /did/:didId
 * Download DID document JSON by DID ID
 * Returns: application/did+json mimetype with DID document content
 */
router.get('/did/:didId', (req, res) => {
  try {
    const { didId } = req.params;
    
    if (!didId) {
      return res.status(400).json({ error: 'DID ID is required' });
    }
    
    const credential = credentialDb.getCredentialByDidId(didId);
    
    if (!credential) {
      return res.status(404).json({ error: 'DID document not found' });
    }
    
    // Return DID document with application/did+json mimetype
    res.set('Content-Type', 'application/did+json');
    res.status(200).send(credential.did_document_json);
   } catch (error) {
     log.error('Error downloading DID document', { error });
     res.status(500).json({ error: 'Internal server error' });
   }
});

/**
 * POST /badges
 * Prepare badge creation (unsigned transaction)
 * Issuer wallet will sign, then submit to /submit-signed-badge-transaction
 * 
 * Body:
 * {
 *   credentialId: string,
 *   issuerWallet: string (currently connected wallet),
 *   emoji: string (e.g., '⭐', '💯', '🏆'),
 *   description: string
 * }
 */
router.post('/badges', async (req, res) => {
  try {
    const { credentialId, issuerWallet, emoji, description } = req.body;
    
    log.info('Received badge creation request');
    
    // Validate required fields
    if (!credentialId || !issuerWallet || !emoji || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(issuerWallet)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    // Check if credential exists
    const credential = credentialDb.getCredentialById(credentialId);
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    // Get credential owner's wallet (recipient of the badge NFT)
    const credentialOwnerWallet = credential.wallet_address;
    log.info('Credential owner (badge recipient):', { credentialOwnerWallet });
    
    // Prevent self-sending badges
    if (issuerWallet === credentialOwnerWallet) {
      log.info('Badge self-send prevented: issuer and owner are the same');
      return res.status(400).json({ error: 'You cannot send a badge to yourself' });
    }
    
    // Create issuer public key for transaction fee payer
    const issuerPublicKey = new web3.PublicKey(issuerWallet);
    log.info('Issuer public key:', { issuerPublicKey });
    
    // Create unsigned transaction with memo containing badge data
    log.info('Creating unsigned transaction for badge...');
    const badgeData = JSON.stringify({ emoji, description });
    const transaction = new web3.Transaction();
    
    // Add compute budget instruction
    const computeBudgetInstruction = new web3.TransactionInstruction({
      programId: COMPUTE_BUDGET_PROGRAM,
      keys: [],
      data: Buffer.concat([
        Buffer.from([0x02]),
        Buffer.alloc(4)
      ])
    });
    computeBudgetInstruction.data.writeUInt32LE(200000, 1);
    transaction.add(computeBudgetInstruction);
    
    // Add memo instruction with badge data
    const memoBuffer = Buffer.from(badgeData, 'utf8');
    transaction.add(
      new web3.TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: memoBuffer
      })
    );
    
    // Get recent blockhash
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    
    // Set issuer (user) as feePayer - they are issuing the badge and should pay for it
    transaction.feePayer = issuerPublicKey;
    
    // Serialize unsigned transaction - issuer will sign via Phantom
    let serializedTx;
    try {
      serializedTx = transaction.serialize({ 
        requireAllSignatures: false,
        verifySignatures: false
      });
    } catch (err) {
      log.error('Error serializing badge transaction:', { error: err });
      return res.status(500).json({ error: 'Failed to prepare badge transaction for signing', details: err.message });
    }
    const base64Tx = serializedTx.toString('base64');
    
    log.info('Unsigned badge transaction prepared, size:', { base64Tx });
    
    // Store temporary badge data (expires in 15 minutes)
    // NOTE: SPL token creation will happen AFTER signing in submit-signed-badge-transaction
    const badgeRegistrationId = uuidv4();
    const badgeData_stored = {
      credentialId,
      issuerWallet,
      credentialOwnerWallet,
      emoji,
      description,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
      timestamp: Date.now()
    };
    
    if (!global.healthCredBadges) {
      global.healthCredBadges = {};
    }
    global.healthCredBadges[badgeRegistrationId] = badgeData_stored;
    
    // Set TTL (15 minutes) - use unref() so it doesn't keep process alive
    const badgeCleanupTimer = setTimeout(() => {
      delete global.healthCredBadges[badgeRegistrationId];
      log.info('Cleaned up expired badge registration:', { badgeRegistrationId });
    }, 15 * 60 * 1000);
    badgeCleanupTimer.unref();
    
    return res.status(200).json({
      success: true,
      badgeRegistrationId,
      transaction: base64Tx,
      metadata: {
        credentialId,
        issuerWallet,
        emoji,
        description,
        message: 'Sign this transaction with your wallet to issue the badge'
      }
    });
  } catch (error) {
    log.error('Badge creation error:', { error: error });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * POST /submit-signed-badge-transaction
 * Submit a signed transaction to complete badge creation
 * 
 * Body:
 * {
 *   badgeRegistrationId: string (from /badges response),
 *   signedTransaction: string (base64 signed transaction from Phantom)
 * }
 */
router.post('/submit-signed-badge-transaction', async (req, res) => {
  try {
    const { badgeRegistrationId, signedTransaction } = req.body;
    
    log.info('Received signed badge transaction submission');
    
    if (!badgeRegistrationId || !signedTransaction) {
      return res.status(400).json({ error: 'Missing badgeRegistrationId or signedTransaction' });
    }
    
    // Retrieve badge data
    if (!global.healthCredBadges || !global.healthCredBadges[badgeRegistrationId]) {
      log.info('Badge registration not found or expired:', { badgeRegistrationId });
      return res.status(404).json({ error: 'Badge registration not found or expired. Please create a new badge.' });
    }
    
     const badgeData = global.healthCredBadges[badgeRegistrationId];
     log.info('Found badge registration for credential:', { badgeData });
     
     // Deserialize and send transaction
     let transactionSignature = '';
     let transactionHash = '';
     try {
       const txBuffer = Buffer.from(signedTransaction, 'base64');
       const transaction = web3.Transaction.from(txBuffer);
       
       log.info('Deserialized signed badge transaction');
       log.info('Sending badge transaction...');
       
       transactionSignature = await connection.sendRawTransaction(transaction.serialize());
       log.info('Badge transaction sent:', { transactionSignature });
       
       log.info('Confirming badge transaction...');
       await connection.confirmTransaction({
         signature: transactionSignature,
         blockhash: badgeData.blockhash,
         lastValidBlockHeight: badgeData.lastValidBlockHeight
       });
       transactionHash = transactionSignature;
       log.info('Badge transaction confirmed');
     } catch (err) {
       log.error('Error sending badge transaction:', { error: err });
       return res.status(500).json({ error: 'Failed to send transaction', details: err.message });
     }
     
     // NOW create SPL Token Mint for badge (after transaction is confirmed)
     log.info('Creating SPL token mint for badge...');
     let mintAddress;
     try {
       const issuerPublicKey = new web3.PublicKey(badgeData.issuerWallet);
       const credentialOwnerPublicKey = new web3.PublicKey(badgeData.credentialOwnerWallet);
       
       log.info('Issuer public key:', { issuerPublicKey });
       log.info('Credential owner public key:', { credentialOwnerPublicKey });
       
       // Create mint with backend payer as mint authority
       log.info('Calling createMint with payer as mint authority...');
       const mint = await createMint(
         connection,
         payer,
         payer.publicKey,  // Backend payer is the mint authority
         payer.publicKey,  // Freeze authority (backend payer)
         0  // 0 decimals = NFT
         );
          mintAddress = mint.toBase58();
          log.info('Badge SPL token mint created (NFT):', { mintAddress });
          
          // Wait for RPC to index the mint (skip in test mode)
          // Use 1.5 seconds for badges to ensure mint is indexed
          if (process.env.NODE_ENV !== 'test') {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
         
          // Create associated token account for credential owner
         log.info('Creating associated token account for credential owner...');
         const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
           connection,
           payer,
           mint,
           credentialOwnerPublicKey
           );
           log.info('Recipient token account:', { recipientTokenAccount });
           
           // Wait for RPC to index the ATA (skip in test mode)
           // Use 2 seconds for badge to ensure ATA is indexed (badges seem to have race conditions)
           if (process.env.NODE_ENV !== 'test') {
             await new Promise(resolve => setTimeout(resolve, 2000));
           }
           
           // Mint 1 badge token to credential owner
          log.info('Minting 1 badge NFT token to credential owner...');
          const badgeMintSig = await mintTo(
            connection,
            payer,
            mint,
            recipientTokenAccount.address,
            payer,
            1  // Mint 1 token
          );
          log.info('Badge NFT minted to recipient, signature:', { badgeMintSig });
       } catch (err) {
         log.error('Error creating SPL token mint for badge:', { error: err });
         log.error('Error message:', { error: err });
         log.error('Error stack:', { error: err });
         return res.status(500).json({ error: 'Failed to create SPL token mint', details: err.message });
       }
     
     // Create badge record in database
     log.info('Creating badge record in database...');
     const badgeId = `badge_${uuidv4()}`;
     const badge = badgeDb.createBadge({
       id: badgeId,
       credentialId: badgeData.credentialId,
       issuerWallet: badgeData.issuerWallet,
       emoji: badgeData.emoji,
       description: badgeData.description,
       mintAddress: mintAddress,
       transactionSignature,
       transactionHash
     });
     
     // Clean up badge data
     delete global.healthCredBadges[badgeRegistrationId];
     
      log.info('Badge creation completed!');
      log.info('Solscan URL: https://solscan.io/tx/' + transactionSignature + '?cluster=devnet');
     
     return res.status(200).json({
       success: true,
       badge: {
         id: badge.id,
         credential_id: badge.credential_id,
         emoji: badge.emoji,
         description: badge.description
       },
       onChain: {
         mint: mintAddress,
         transactionSignature,
         solscanUrl: `https://solscan.io/tx/${transactionSignature}?cluster=devnet`
       }
     });
  } catch (error) {
    log.error('Signed badge transaction submission error:', { error: error });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * GET /badges/:credentialId
 * Get all badges for a credential
 */
router.get('/badges/:credentialId', (req, res) => {
  try {
    const { credentialId } = req.params;
    
    const credential = credentialDb.getCredentialById(credentialId);
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    const badges = badgeDb.getBadgesByCredentialId(credentialId);
    
    res.status(200).json({
      credential_id: credentialId,
      badges: badges || []
    });
   } catch (error) {
     log.error('Error fetching badges', { error });
     res.status(500).json({ error: 'Internal server error' });
   }
});

/**
 * POST /certifications
 * Prepare certification upload (unsigned transaction)
 * Issuer wallet will sign, then submit to /submit-signed-certification-transaction
 * 
 * Body:
 * {
 *   credentialId: string,
 *   issuerWallet: string (currently connected wallet),
 *   certificationName: string,
 *   filename: string,
 *   fileBuffer: Buffer (PDF, PNG, or JPG),
 *   fileSize: number,
 *   fileType: string (MIME type)
 * }
 */
router.post('/certifications', async (req, res) => {
  try {
    const { credentialId, issuerWallet, certificationName, filename, fileBuffer, fileSize, fileType } = req.body;
    
    log.info('Received certification submission request');
    
    // Validate required fields
    if (!credentialId || !issuerWallet || !certificationName || !filename || !fileBuffer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(issuerWallet)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!validTypes.includes(fileType)) {
      return res.status(400).json({ error: 'Invalid file type. Accepted: PDF, PNG, JPG' });
    }
    
    // Check if credential exists
    const credential = credentialDb.getCredentialById(credentialId);
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    // Calculate SHA2-256 hash of file
    log.info('Calculating file hash...');
    // Convert file buffer array back to Buffer if needed
    const fileBufferAsBuffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const fileHash = crypto
      .createHash('sha256')
      .update(fileBufferAsBuffer)
      .digest('hex');
    log.info('File hash:', { fileHash });
    
    // Get credential owner's wallet (recipient of the certification)
    const certCredential = credentialDb.getCredentialById(credentialId);
    if (!certCredential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    const credentialOwnerWallet = certCredential.wallet_address;
    log.info('Credential owner (certification recipient):', { credentialOwnerWallet });
    
    // Create issuer public key for transaction fee payer
    const issuerPublicKey = new web3.PublicKey(issuerWallet);
    log.info('Issuer public key:', { issuerPublicKey });
    
    // Create unsigned transaction with memo containing certification metadata
    log.info('Creating unsigned transaction for certification with memo...');
    const memoText = `${certCredential.full_name} certification ${certificationName}: ${filename} - ${fileHash} (SHA2-256)`;
    const transaction = new web3.Transaction();
    
    // Add compute budget instruction
    const computeBudgetInstruction = new web3.TransactionInstruction({
      programId: COMPUTE_BUDGET_PROGRAM,
      keys: [],
      data: Buffer.concat([
        Buffer.from([0x02]),
        Buffer.alloc(4)
      ])
    });
    computeBudgetInstruction.data.writeUInt32LE(200000, 1);
    transaction.add(computeBudgetInstruction);
    
    // Add memo instruction with certification metadata
    const memoBuffer = Buffer.from(memoText, 'utf8');
    transaction.add(
      new web3.TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: memoBuffer
      })
    );
    
    // Get recent blockhash
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    
    // Set issuer (user) as feePayer - they are issuing the certification and should pay for it
    transaction.feePayer = issuerPublicKey;
    
    // Serialize unsigned transaction - issuer will sign via Phantom
    let serializedTx;
    try {
      serializedTx = transaction.serialize({ 
        requireAllSignatures: false,
        verifySignatures: false
      });
    } catch (err) {
      log.error('Error serializing certification transaction:', { error: err });
      return res.status(500).json({ error: 'Failed to prepare certification transaction for signing', details: err.message });
    }
    const base64Tx = serializedTx.toString('base64');
    
    log.info('Unsigned certification transaction prepared, size:', { base64Tx });
    
    // Store temporary certification data (expires in 15 minutes)
    // NOTE: No SPL token creation - only memo-based transaction
    const certRegistrationId = uuidv4();
    const certData_stored = {
      credentialId,
      issuerWallet,
      credentialOwnerWallet,
      certificationName,
      filename,
      fileBuffer, // Store raw file for later
      fileSize,
      fileType,
      fileHash,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
      timestamp: Date.now()
    };
    
    if (!global.healthCredCertifications) {
      global.healthCredCertifications = {};
    }
    global.healthCredCertifications[certRegistrationId] = certData_stored;
    
    // Set TTL (15 minutes) - use unref() so it doesn't keep process alive
    const certCleanupTimer = setTimeout(() => {
      delete global.healthCredCertifications[certRegistrationId];
      log.info('Cleaned up expired certification registration:', { certRegistrationId });
    }, 15 * 60 * 1000);
    certCleanupTimer.unref();
    
    return res.status(200).json({
      success: true,
      certificationRegistrationId: certRegistrationId,
      transaction: base64Tx,
      metadata: {
        credentialId,
        issuerWallet,
        certificationName,
        filename,
        fileHash,
        message: 'Sign this transaction with your wallet to upload the certification'
      }
    });
  } catch (error) {
    log.error('Certification submission error:', { error: error });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 **
 * POST /submit-signed-certification-transaction
 * Submit a signed transaction to complete certification upload
 * 
 * Body:
 * {
 *   certificationRegistrationId: string (from /certifications response),
 *   signedTransaction: string (base64 signed transaction from Phantom)
 * }
 */
router.post('/submit-signed-certification-transaction', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const { certificationRegistrationId, signedTransaction } = req.body;
    
    log.info('Received signed certification transaction submission');
    
    if (!certificationRegistrationId || !signedTransaction) {
      return res.status(400).json({ error: 'Missing certificationRegistrationId or signedTransaction' });
    }
    
    // Retrieve certification data
    if (!global.healthCredCertifications || !global.healthCredCertifications[certificationRegistrationId]) {
      log.info('Certification registration not found or expired:', { certificationRegistrationId });
      return res.status(404).json({ error: 'Certification registration not found or expired. Please create a new certification.' });
    }
    
     const certData = global.healthCredCertifications[certificationRegistrationId];
     log.info('Found certification registration for credential:', { certData });
     
     // Deserialize and send transaction
     let transactionSignature = '';
     let transactionHash = '';
     try {
       const txBuffer = Buffer.from(signedTransaction, 'base64');
       const transaction = web3.Transaction.from(txBuffer);
       
       log.info('Deserialized signed certification transaction');
       log.info('Sending certification transaction...');
       
       transactionSignature = await connection.sendRawTransaction(transaction.serialize());
       log.info('Certification transaction sent:', { transactionSignature });
       
       log.info('Confirming certification transaction...');
       await connection.confirmTransaction({
         signature: transactionSignature,
         blockhash: certData.blockhash,
         lastValidBlockHeight: certData.lastValidBlockHeight
       });
       transactionHash = transactionSignature;
       log.info('Certification transaction confirmed');
     } catch (err) {
       log.error('Error sending certification transaction:', { error: err });
       return res.status(500).json({ error: 'Failed to send transaction', details: err.message });
      }
      
       // Store file to filesystem under uploads/{credentialId}/{filename}
       // SKIP FILE WRITES DURING TESTS to prevent polluting production uploads/
       if (process.env.NODE_ENV !== 'test') {
         log.info('Storing certification file to filesystem...');
         const config = require('./config');
         let uploadsBasePath = config.uploads.path;
         
         // If it's a relative path, resolve it relative to project root
         if (!path.isAbsolute(uploadsBasePath)) {
           uploadsBasePath = path.join(__dirname, '..', uploadsBasePath);
         }
         
         const walletDir = path.join(uploadsBasePath, certData.credentialId.split('_')[1] || certData.issuerWallet);
         
         try {
           // Create wallet directory if it doesn't exist
           if (!fs.existsSync(walletDir)) {
             fs.mkdirSync(walletDir, { recursive: true });
             log.info('Created uploads directory:', { walletDir });
           }
           
           // Store file
           const fileBufferAsBuffer = Buffer.isBuffer(certData.fileBuffer) ? certData.fileBuffer : Buffer.from(certData.fileBuffer);
           const filePath = path.join(walletDir, certData.filename);
           fs.writeFileSync(filePath, fileBufferAsBuffer);
           log.info('Certification file stored at:', { filePath });
         } catch (err) {
           log.error('Error storing certification file:', { error: err });
           // Don't fail the transaction if file storage fails, but log it
         }
       } else {
         log.info('Skipping file storage during tests (NODE_ENV=test)');
       }
       
       // Create certification record in database (NO SPL token creation)
      log.info('Creating certification record in database...');
      const certId = `cert_${uuidv4()}`;
      const certification = certificationDb.createCertification({
        id: certId,
        credentialId: certData.credentialId,
        issuerWallet: certData.issuerWallet,
        certificationName: certData.certificationName,
        filename: certData.filename,
        fileHash: certData.fileHash,
        fileSize: certData.fileSize,
        fileType: certData.fileType,
        transactionSignature,
        transactionHash
      });
      
      // Clean up certification data
      delete global.healthCredCertifications[certificationRegistrationId];
      
      log.info('Certification upload completed!');
      
      return res.status(200).json({
        success: true,
        certification: {
          id: certification.id,
          credential_id: certification.credential_id,
          certification_name: certification.certification_name,
          filename: certification.filename,
          file_hash: certification.file_hash
        },
        onChain: {
          transactionSignature,
          memoUrl: `https://solscan.io/tx/${transactionHash}?cluster=devnet`
        }
      });
   } catch (error) {
     log.error('Signed certification transaction submission error:', { error: error });
     res.status(500).json({ error: 'Internal server error', details: error.message });
   }
});

/**
 * GET /certifications/:credentialId
 * Get all certifications for a credential
 */
router.get('/certifications/:credentialId', (req, res) => {
  try {
    const { credentialId } = req.params;
    
    const credential = credentialDb.getCredentialById(credentialId);
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    const certifications = certificationDb.getCertificationsByCredentialId(credentialId);
    
    res.status(200).json({
      credential_id: credentialId,
      certifications: certifications || []
    });
   } catch (error) {
     log.error('Error fetching certifications', { error });
     res.status(500).json({ error: 'Internal server error' });
   }
});

module.exports = router;
