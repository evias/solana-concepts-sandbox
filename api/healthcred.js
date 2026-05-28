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
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const { payer } = require('./payer');
const { credentialDb, badgeDb, certificationDb } = require('./database');

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
 * POST /register
 * Prepare credential registration (unsigned transaction)
 * User will sign with their wallet, then submit to /submit-signed-transaction
 * 
 * Body:
 * {
 *   walletAddress: string (currently connected wallet - will be payer and mint owner),
 *   fullName: string,
 *   dateOfBirth: string (YYYY-MM-DD),
 *   email: string,
 *   profession: string,
 *   didDocumentJson: string (JSON stringified DID document)
 * }
 * 
 * Returns: Unsigned transaction (base64) for user to sign
 */
router.post('/register', async (req, res) => {
  try {
    const { walletAddress, fullName, dateOfBirth, email, profession, didDocumentJson } = req.body;
    
    console.log('[HealthCred] Received registration request');
    console.log('[HealthCred] Wallet:', walletAddress);
    console.log('[HealthCred] Full Name:', fullName);
    console.log('[HealthCred] Profession:', profession);
    console.log('[HealthCred] Email:', email);
    
    // Validate required fields
    if (!walletAddress || !fullName || !dateOfBirth || !email || !profession || !didDocumentJson) {
      console.log('[HealthCred] Validation failed: Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      console.log('[HealthCred] Validation failed: Invalid wallet address format');
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    // Validate DID document (no longer checking for duplicate wallet addresses)
    // A wallet can have multiple credentials; uniqueness is on did_document_hash
    console.log('[HealthCred] Validating DID document...');
    let didDoc;
    try {
      didDoc = JSON.parse(didDocumentJson);
    } catch (err) {
      console.log('[HealthCred] DID document parsing failed:', err.message);
      return res.status(400).json({ error: 'Invalid DID Document JSON' });
    }
    
    if (!didDoc.id || typeof didDoc.id !== 'string') {
      console.log('[HealthCred] DID document missing valid id field');
      return res.status(400).json({ error: 'DID Document must contain valid "id" field' });
    }
    
    if (!Array.isArray(didDoc.authentication)) {
      console.log('[HealthCred] DID document missing authentication array');
      return res.status(400).json({ error: 'DID Document must contain "authentication" array' });
    }
    
    console.log('[HealthCred] DID ID:', didDoc.id);
    console.log('[HealthCred] Authentication methods:', didDoc.authentication.length);
    
    // Calculate SHA2-256 hash of DID document
    console.log('[HealthCred] Calculating DID document hash...');
    const didDocumentHash = crypto
      .createHash('sha256')
      .update(didDocumentJson)
      .digest('hex');
    console.log('[HealthCred] DID document hash:', didDocumentHash);
    
    // Create NFT Mint (0 decimals) for this credential, owned by user wallet
    console.log('[HealthCred] Creating NFT mint (owned by user wallet)...');
     const userPublicKey = new web3.PublicKey(walletAddress);
    let mintAddress;
    try {
      const mint = await createMint(
        connection,
        payer,              // Backend payer (pays for transaction)
        userPublicKey,      // Mint authority (user wallet owns the mint)
        null,               // Freeze authority
        0                   // 0 decimals = NFT
      );
      mintAddress = mint.toBase58();
      console.log('[HealthCred] NFT mint created (user-owned):', mintAddress);
    } catch (err) {
      console.error('[HealthCred] Error creating NFT mint:', err.message);
      return res.status(500).json({ error: 'Failed to create NFT mint' });
    }
    
    // Create associated token account for user and mint 1 token
    console.log('[HealthCred] Creating associated token account for user...');
    try {
      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        new web3.PublicKey(mintAddress),
        userPublicKey
      );
      console.log('[HealthCred] User token account:', userTokenAccount.address.toBase58());
      
      // Mint 1 token to user
      console.log('[HealthCred] Minting 1 NFT token to user...');
      const mintSig = await mintTo(
        connection,
        payer,
        new web3.PublicKey(mintAddress),
        userTokenAccount.address,
        payer,
        1  // Mint 1 token
      );
      console.log('[HealthCred] NFT minted, signature:', mintSig);
    } catch (err) {
      console.error('[HealthCred] Error creating token account or minting:', err.message);
      return res.status(500).json({ error: 'Failed to mint NFT token', details: err.message });
    }
    
    // Create unsigned transaction with user as fee payer (2-step: user signs in Phantom)
    console.log('[HealthCred] Creating unsigned transaction for user to sign...');
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
    console.log('[HealthCred] Adding memo instruction with DID document (', didDocumentJson.length, 'bytes)');
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
    console.log('[HealthCred] Recent blockhash:', blockhash.blockhash);
    
    // Set user wallet as fee payer (user pays for transaction)
    transaction.feePayer = userPublicKey;
    console.log('[HealthCred] Set transaction fee payer to user wallet:', userPublicKey.toBase58());
    
    // Serialize unsigned transaction for user to sign via Phantom
    let serializedTx;
    try {
      console.log('[HealthCred] Serializing unsigned transaction for user to sign...');
      serializedTx = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });
      console.log('[HealthCred] Unsigned transaction serialized, size:', serializedTx.length);
    } catch (err) {
      console.error('[HealthCred] Error serializing transaction:', err.message);
      console.error('[HealthCred] Error stack:', err.stack);
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
      mintAddress,
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
      console.log('[HealthCred] Cleaned up expired registration:', registrationId);
    }, 15 * 60 * 1000);
    cleanupTimer.unref();
    
    console.log('[HealthCred] Registration prepared, waiting for user signature');
    
    return res.status(200).json({
      success: true,
      registrationId,
      transaction: base64Tx,
      metadata: {
        walletAddress,
        fullName,
        profession,
        mint: mintAddress,
        message: 'Sign this transaction with your wallet to complete registration'
      }
    });
  } catch (error) {
    console.error('[HealthCred] Registration preparation error:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * POST /submit-signed-transaction
 * Submit a signed transaction to complete credential registration
 * 
 * Body:
 * {
 *   registrationId: string (from /register response),
 *   signedTransaction: string (base64 signed transaction from Phantom)
 * }
 */
router.post('/submit-signed-transaction', async (req, res) => {
  try {
    const { registrationId, signedTransaction } = req.body;
    
    console.log('[HealthCred] Received signed transaction submission');
    console.log('[HealthCred] Registration ID:', registrationId);
    
    if (!registrationId || !signedTransaction) {
      return res.status(400).json({ error: 'Missing registrationId or signedTransaction' });
    }
    
    // Retrieve registration data
    if (!global.healthCredRegistrations || !global.healthCredRegistrations[registrationId]) {
      console.log('[HealthCred] Registration not found or expired:', registrationId);
      return res.status(404).json({ error: 'Registration not found or expired. Please create a new registration.' });
    }
    
    const regData = global.healthCredRegistrations[registrationId];
    console.log('[HealthCred] Found registration for wallet:', regData.walletAddress);
    
    // Deserialize and send transaction
    let transactionSignature = '';
    let transactionHash = '';
    try {
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      const transaction = web3.Transaction.from(txBuffer);
      
      console.log('[HealthCred] Deserialized signed transaction');
      console.log('[HealthCred] Sending transaction...');
      
      transactionSignature = await connection.sendRawTransaction(transaction.serialize());
      console.log('[HealthCred] Transaction sent:', transactionSignature);
      
      console.log('[HealthCred] Confirming transaction...');
      await connection.confirmTransaction({
        signature: transactionSignature,
        blockhash: regData.blockhash,
        lastValidBlockHeight: regData.lastValidBlockHeight
      });
      transactionHash = transactionSignature;
      console.log('[HealthCred] Transaction confirmed');
    } catch (err) {
      console.error('[HealthCred] Error sending transaction:', err.message);
      return res.status(500).json({ error: 'Failed to send transaction', details: err.message });
    }
    
    // Create credential record in database
    console.log('[HealthCred] Creating credential record in database...');
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
        sasCredentialId: `sas_${Date.now()}`,
        mintAddress: regData.mintAddress,
        transactionSignature,
        transactionHash
      });
    } catch (dbErr) {
      console.error('[HealthCred] Database error creating credential:', dbErr.message);
      // Clean up registration data even if creation fails
      delete global.healthCredRegistrations[registrationId];
      return res.status(500).json({ error: 'Failed to save credential', details: dbErr.message });
    }
    
    // Clean up registration data
    delete global.healthCredRegistrations[registrationId];
    
    console.log('[HealthCred] Registration completed!');
    console.log('[HealthCred] Credential ID:', credentialId);
    console.log('[HealthCred] Transaction URL: https://solscan.io/tx/' + transactionHash + '?cluster=devnet');
    
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
        mint: regData.mintAddress,
        transactionSignature,
        memoUrl: `https://solscan.io/tx/${transactionHash}?cluster=devnet`
      },
      metadata: {
        solscanUrl: `https://solscan.io/tx/${transactionHash}?cluster=devnet`,
        didDocumentHash: regData.didDocumentHash
      }
    });
  } catch (error) {
    console.error('[HealthCred] Signed transaction submission error:', error.message);
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
    console.error('Error fetching credentials:', error);
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
    console.error('Error fetching credential:', error);
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
    console.error('Error downloading DID document:', error);
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
    
    console.log('[HealthCred] Received badge creation request');
    
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
    
    // Create SPL Token Mint for badge (issuer-owned)
    console.log('[HealthCred] Creating SPL token mint for badge...');
    const issuerPublicKey = new web3.PublicKey(issuerWallet);
    let mintAddress;
    try {
      const mint = await createMint(
        connection,
        payer,
        issuerPublicKey,
        null,
        9
      );
      mintAddress = mint.toBase58();
      console.log('[HealthCred] Badge SPL token mint created:', mintAddress);
    } catch (err) {
      console.error('[HealthCred] Error creating SPL token mint for badge:', err.message);
      return res.status(500).json({ error: 'Failed to create SPL token mint' });
    }
    
    // Create unsigned transaction with memo containing badge data
    console.log('[HealthCred] Creating unsigned transaction for badge...');
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
    
    // Set backend payer as feePayer for serialization (frontend issuer will sign, backend will broadcast)
    transaction.feePayer = payer.publicKey;
    
    // Serialize unsigned transaction - issuer will sign via Phantom
    let serializedTx;
    try {
      serializedTx = transaction.serialize({ 
        requireAllSignatures: false,
        verifySignatures: false
      });
    } catch (err) {
      console.error('[HealthCred] Error serializing badge transaction:', err.message);
      return res.status(500).json({ error: 'Failed to prepare badge transaction for signing', details: err.message });
    }
    const base64Tx = serializedTx.toString('base64');
    
    console.log('[HealthCred] Unsigned badge transaction prepared, size:', base64Tx.length);
    
    // Store temporary badge data (expires in 15 minutes)
    const badgeRegistrationId = uuidv4();
    const badgeData_stored = {
      credentialId,
      issuerWallet,
      emoji,
      description,
      mintAddress,
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
      console.log('[HealthCred] Cleaned up expired badge registration:', badgeRegistrationId);
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
        mint: mintAddress,
        message: 'Sign this transaction with your wallet to issue the badge'
      }
    });
  } catch (error) {
    console.error('[HealthCred] Badge creation error:', error.message);
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
    
    console.log('[HealthCred] Received signed badge transaction submission');
    
    if (!badgeRegistrationId || !signedTransaction) {
      return res.status(400).json({ error: 'Missing badgeRegistrationId or signedTransaction' });
    }
    
    // Retrieve badge data
    if (!global.healthCredBadges || !global.healthCredBadges[badgeRegistrationId]) {
      console.log('[HealthCred] Badge registration not found or expired:', badgeRegistrationId);
      return res.status(404).json({ error: 'Badge registration not found or expired. Please create a new badge.' });
    }
    
    const badgeData = global.healthCredBadges[badgeRegistrationId];
    console.log('[HealthCred] Found badge registration for credential:', badgeData.credentialId);
    
    // Deserialize and send transaction
    let transactionSignature = '';
    let transactionHash = '';
    try {
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      const transaction = web3.Transaction.from(txBuffer);
      
      console.log('[HealthCred] Deserialized signed badge transaction');
      console.log('[HealthCred] Sending badge transaction...');
      
      transactionSignature = await connection.sendRawTransaction(transaction.serialize());
      console.log('[HealthCred] Badge transaction sent:', transactionSignature);
      
      console.log('[HealthCred] Confirming badge transaction...');
      await connection.confirmTransaction({
        signature: transactionSignature,
        blockhash: badgeData.blockhash,
        lastValidBlockHeight: badgeData.lastValidBlockHeight
      });
      transactionHash = transactionSignature;
      console.log('[HealthCred] Badge transaction confirmed');
    } catch (err) {
      console.error('[HealthCred] Error sending badge transaction:', err.message);
      return res.status(500).json({ error: 'Failed to send transaction', details: err.message });
    }
    
    // Create badge record in database
    console.log('[HealthCred] Creating badge record in database...');
    const badgeId = `badge_${uuidv4()}`;
    const badge = badgeDb.createBadge({
      id: badgeId,
      credentialId: badgeData.credentialId,
      issuerWallet: badgeData.issuerWallet,
      emoji: badgeData.emoji,
      description: badgeData.description,
      mintAddress: badgeData.mintAddress,
      transactionSignature,
      transactionHash
    });
    
    // Clean up badge data
    delete global.healthCredBadges[badgeRegistrationId];
    
    console.log('[HealthCred] Badge creation completed!');
    
    return res.status(200).json({
      success: true,
      badge: {
        id: badge.id,
        credential_id: badge.credential_id,
        emoji: badge.emoji,
        description: badge.description
      },
      onChain: {
        mint: badgeData.mintAddress,
        transactionSignature,
        memoUrl: `https://solscan.io/tx/${transactionHash}?cluster=devnet`
      }
    });
  } catch (error) {
    console.error('[HealthCred] Signed badge transaction submission error:', error.message);
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
    console.error('Error fetching badges:', error);
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
 *   filename: string,
 *   fileBuffer: Buffer (PDF, PNG, or JPG),
 *   fileSize: number,
 *   fileType: string (MIME type)
 * }
 */
router.post('/certifications', async (req, res) => {
  try {
    const { credentialId, issuerWallet, filename, fileBuffer, fileSize, fileType } = req.body;
    
    console.log('[HealthCred] Received certification submission request');
    
    // Validate required fields
    if (!credentialId || !issuerWallet || !filename || !fileBuffer) {
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
    console.log('[HealthCred] Calculating file hash...');
    // Convert file buffer array back to Buffer if needed
    const fileBufferAsBuffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const fileHash = crypto
      .createHash('sha256')
      .update(fileBufferAsBuffer)
      .digest('hex');
    console.log('[HealthCred] File hash:', fileHash);
    
    // Create SPL Token Mint for certification (issuer-owned)
    console.log('[HealthCred] Creating SPL token mint for certification...');
    const issuerPublicKey = new web3.PublicKey(issuerWallet);
    let mintAddress;
    try {
      const mint = await createMint(
        connection,
        payer,
        issuerPublicKey,
        null,
        9
      );
      mintAddress = mint.toBase58();
      console.log('[HealthCred] Certification SPL token mint created:', mintAddress);
    } catch (err) {
      console.error('[HealthCred] Error creating SPL token mint for certification:', err.message);
      return res.status(500).json({ error: 'Failed to create SPL token mint' });
    }
    
    // Create unsigned transaction with memo containing certification metadata
    console.log('[HealthCred] Creating unsigned transaction for certification...');
    const certData = JSON.stringify({ filename, bodyHash: fileHash });
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
    const memoBuffer = Buffer.from(certData, 'utf8');
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
    
    // Set backend payer as feePayer for serialization (frontend issuer will sign, backend will broadcast)
    transaction.feePayer = payer.publicKey;
    
    // Serialize unsigned transaction - issuer will sign via Phantom
    let serializedTx;
    try {
      serializedTx = transaction.serialize({ 
        requireAllSignatures: false,
        verifySignatures: false
      });
    } catch (err) {
      console.error('[HealthCred] Error serializing certification transaction:', err.message);
      return res.status(500).json({ error: 'Failed to prepare certification transaction for signing', details: err.message });
    }
    const base64Tx = serializedTx.toString('base64');
    
    console.log('[HealthCred] Unsigned certification transaction prepared');
    
    // Store temporary certification data (expires in 15 minutes)
    const certRegistrationId = uuidv4();
    const certData_stored = {
      credentialId,
      issuerWallet,
      filename,
      fileBuffer, // Store raw file for later
      fileSize,
      fileType,
      fileHash,
      mintAddress,
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
      console.log('[HealthCred] Cleaned up expired certification registration:', certRegistrationId);
    }, 15 * 60 * 1000);
    certCleanupTimer.unref();
    
    return res.status(200).json({
      success: true,
      certificationRegistrationId: certRegistrationId,
      transaction: base64Tx,
      metadata: {
        credentialId,
        issuerWallet,
        filename,
        fileHash,
        mint: mintAddress,
        message: 'Sign this transaction with your wallet to upload the certification'
      }
    });
  } catch (error) {
    console.error('[HealthCred] Certification submission error:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
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
    const { certificationRegistrationId, signedTransaction } = req.body;
    
    console.log('[HealthCred] Received signed certification transaction submission');
    
    if (!certificationRegistrationId || !signedTransaction) {
      return res.status(400).json({ error: 'Missing certificationRegistrationId or signedTransaction' });
    }
    
    // Retrieve certification data
    if (!global.healthCredCertifications || !global.healthCredCertifications[certificationRegistrationId]) {
      console.log('[HealthCred] Certification registration not found or expired:', certificationRegistrationId);
      return res.status(404).json({ error: 'Certification registration not found or expired. Please create a new certification.' });
    }
    
    const certData = global.healthCredCertifications[certificationRegistrationId];
    console.log('[HealthCred] Found certification registration for credential:', certData.credentialId);
    
    // Deserialize and send transaction
    let transactionSignature = '';
    let transactionHash = '';
    try {
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      const transaction = web3.Transaction.from(txBuffer);
      
      console.log('[HealthCred] Deserialized signed certification transaction');
      console.log('[HealthCred] Sending certification transaction...');
      
      transactionSignature = await connection.sendRawTransaction(transaction.serialize());
      console.log('[HealthCred] Certification transaction sent:', transactionSignature);
      
      console.log('[HealthCred] Confirming certification transaction...');
      await connection.confirmTransaction({
        signature: transactionSignature,
        blockhash: certData.blockhash,
        lastValidBlockHeight: certData.lastValidBlockHeight
      });
      transactionHash = transactionSignature;
      console.log('[HealthCred] Certification transaction confirmed');
    } catch (err) {
      console.error('[HealthCred] Error sending certification transaction:', err.message);
      return res.status(500).json({ error: 'Failed to send transaction', details: err.message });
    }
    
    // Create certification record in database
    console.log('[HealthCred] Creating certification record in database...');
    const certId = `cert_${uuidv4()}`;
    const certification = certificationDb.createCertification({
      id: certId,
      credentialId: certData.credentialId,
      issuerWallet: certData.issuerWallet,
      filename: certData.filename,
      fileHash: certData.fileHash,
      fileSize: certData.fileSize,
      fileType: certData.fileType,
      mintAddress: certData.mintAddress,
      transactionSignature,
      transactionHash
    });
    
    // Clean up certification data
    delete global.healthCredCertifications[certificationRegistrationId];
    
    console.log('[HealthCred] Certification upload completed!');
    
    return res.status(200).json({
      success: true,
      certification: {
        id: certification.id,
        credential_id: certification.credential_id,
        filename: certification.filename,
        file_hash: certification.file_hash
      },
      onChain: {
        mint: certData.mintAddress,
        transactionSignature,
        memoUrl: `https://solscan.io/tx/${transactionHash}?cluster=devnet`
      }
    });
  } catch (error) {
    console.error('[HealthCred] Signed certification transaction submission error:', error.message);
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
    console.error('Error fetching certifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
