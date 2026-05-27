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
router.post('/register', async (req, res) => {
  try {
    const { walletAddress, fullName, dateOfBirth, email, profession, didDocumentJson } = req.body;
    
    // Validate required fields
    if (!walletAddress || !fullName || !dateOfBirth || !email || !profession || !didDocumentJson) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    // Check if credential already exists for this wallet
    const existing = credentialDb.getCredentialByWallet(walletAddress);
    if (existing) {
      return res.status(409).json({ error: 'Credential already exists for this wallet' });
    }
    
    // Parse and validate DID document
    let didDoc;
    try {
      didDoc = JSON.parse(didDocumentJson);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid DID Document JSON' });
    }
    
    if (!didDoc.id || typeof didDoc.id !== 'string') {
      return res.status(400).json({ error: 'DID Document must contain valid "id" field' });
    }
    
    if (!Array.isArray(didDoc.authentication)) {
      return res.status(400).json({ error: 'DID Document must contain "authentication" array' });
    }
    
    // Calculate SHA2-256 hash of DID document
    const didDocumentHash = crypto
      .createHash('sha256')
      .update(didDocumentJson)
      .digest('hex');
    
    // Create SPL Token Mint for this credential
    let mintAddress;
    try {
      const mint = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        9
      );
      mintAddress = mint.toBase58();
    } catch (err) {
      console.error('Error creating SPL token mint:', err);
      return res.status(500).json({ error: 'Failed to create SPL token mint' });
    }
    
    // Create transaction with memo containing DID document
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
    const memoBuffer = Buffer.from(didDocumentJson, 'utf8');
    transaction.add(
      new web3.TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: memoBuffer
      })
    );
    
    // Sign and send transaction
    transaction.feePayer = payer.publicKey;
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    transaction.sign(payer);
    
    let transactionSignature = '', transactionHash = '';
    try {
      transactionSignature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({
        signature: transactionSignature,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight
      });
      transactionHash = transactionSignature;
    } catch (err) {
      console.error('Error sending transaction:', err);
      return res.status(500).json({ error: 'Failed to send transaction', details: err.message });
    }
    
    // Create credential record in database
    const credentialId = `hc_${uuidv4()}`;
    const credential = credentialDb.createCredential({
      id: credentialId,
      walletAddress,
      fullName,
      dateOfBirth,
      email,
      profession,
      didDocumentJson,
      didDocumentHash,
      didId: didDoc.id,
      authenticationMethods: JSON.stringify(didDoc.authentication),
      sasCredentialId: `sas_${Date.now()}`, // Placeholder for actual SAS credential
      mintAddress,
      transactionSignature,
      transactionHash
    });
    
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
        didDocumentHash
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
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
    
    // Remove sensitive DID document from list view
    const sanitized = credentials.map(c => ({
      id: c.id,
      wallet_address: c.wallet_address,
      full_name: c.full_name,
      profession: c.profession,
      email: c.email,
      did_id: c.did_id,
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
      profession: credential.profession,
      email: credential.email,
      did_id: credential.did_id,
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
 * Issue a badge to a credential
 * Currently connected wallet signs and pays for SPL token
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
    
    // Create SPL Token Mint for badge
    let mintAddress;
    try {
      const mint = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        9
      );
      mintAddress = mint.toBase58();
    } catch (err) {
      console.error('Error creating SPL token mint for badge:', err);
      return res.status(500).json({ error: 'Failed to create SPL token mint' });
    }
    
    // Create transaction with memo containing badge data
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
    
    // Sign and send transaction
    transaction.feePayer = payer.publicKey;
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    transaction.sign(payer);
    
    let transactionSignature = '', transactionHash = '';
    try {
      transactionSignature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({
        signature: transactionSignature,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight
      });
      transactionHash = transactionSignature;
    } catch (err) {
      console.error('Error sending badge transaction:', err);
      return res.status(500).json({ error: 'Failed to send transaction' });
    }
    
    // Create badge record in database
    const badgeId = `badge_${uuidv4()}`;
    const badge = badgeDb.createBadge({
      id: badgeId,
      credentialId,
      issuerWallet,
      emoji,
      description,
      mintAddress,
      transactionSignature,
      transactionHash
    });
    
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
        memoUrl: `https://solscan.io/tx/${transactionHash}?cluster=devnet`
      }
    });
  } catch (error) {
    console.error('Badge creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
 * Upload a certification file
 * Currently connected wallet signs and pays for SPL token
 * 
 * Body (multipart/form-data):
 * {
 *   credentialId: string,
 *   issuerWallet: string (currently connected wallet),
 *   filename: string,
 *   file: Buffer (PDF, PNG, or JPG)
 * }
 */
router.post('/certifications', async (req, res) => {
  try {
    const { credentialId, issuerWallet, filename, fileBuffer, fileSize, fileType } = req.body;
    
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
    const fileHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');
    
    // Create SPL Token Mint for certification
    let mintAddress;
    try {
      const mint = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        9
      );
      mintAddress = mint.toBase58();
    } catch (err) {
      console.error('Error creating SPL token mint for certification:', err);
      return res.status(500).json({ error: 'Failed to create SPL token mint' });
    }
    
    // Create transaction with memo containing certification metadata
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
    
    // Sign and send transaction
    transaction.feePayer = payer.publicKey;
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    transaction.sign(payer);
    
    let transactionSignature = '', transactionHash = '';
    try {
      transactionSignature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({
        signature: transactionSignature,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight
      });
      transactionHash = transactionSignature;
    } catch (err) {
      console.error('Error sending certification transaction:', err);
      return res.status(500).json({ error: 'Failed to send transaction' });
    }
    
    // Create certification record in database
    const certId = `cert_${uuidv4()}`;
    const certification = certificationDb.createCertification({
      id: certId,
      credentialId,
      issuerWallet,
      filename,
      fileHash,
      fileSize,
      fileType,
      mintAddress,
      transactionSignature,
      transactionHash
    });
    
    return res.status(200).json({
      success: true,
      certification: {
        id: certification.id,
        credential_id: certification.credential_id,
        filename: certification.filename,
        file_hash: certification.file_hash
      },
      onChain: {
        mint: mintAddress,
        transactionSignature,
        memoUrl: `https://solscan.io/tx/${transactionHash}?cluster=devnet`
      }
    });
  } catch (error) {
    console.error('Certification upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
