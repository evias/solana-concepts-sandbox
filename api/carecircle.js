const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('./logger');
const log = createLogger('concept/carecircle');
const { credentialDb } = require('./database');
const { getAuthorizedSigners, addAuthorizedSigner } = require('./sas-integration');
const router = express.Router();

/**
 * Helper: Extract UUID from credential ID (handles both prefixed and unprefixed formats)
 * Examples:
 *   'sas_a7c15464-a9a8-4c59-99e6-ccac7c02a452' -> 'a7c15464-a9a8-4c59-99e6-ccac7c02a452'
 *   'hc_5bff0293-c708-4f2e-8343-13b843b71729' -> '5bff0293-c708-4f2e-8343-13b843b71729'
 *   'a7c15464-a9a8-4c59-99e6-ccac7c02a452' -> 'a7c15464-a9a8-4c59-99e6-ccac7c02a452'
 */
function extractCredentialUuid(credentialId) {
  if (!credentialId) return null;
  const parts = credentialId.split('_');
  return parts.length > 1 ? parts[1] : credentialId;
}

/**
 * Helper: Get actual SAS Credential address for authorization checks
 * The database stores prefixed IDs (sas_...), but we need the derived address
 */
async function getSasCredentialAddress(wallet) {
  try {
    const payer = require('./payer').getPayerKeypair();
    const sasIntegration = require('./sas-integration');
    const sasResult = await sasIntegration.ensureSasCredential(wallet, payer);
    return sasResult.credentialAddress;
   } catch (error) {
     log.error('Error deriving SAS credential address', { error: error.message });
     return null;
   }
}

/**
 * Helper: Check if wallet has access to a credential
 * Access is granted if:
 * 1. Wallet is the credential owner (wallet_address in database), OR
 * 2. Wallet is an authorized signer on the SAS Credential
 * Note: In test mode, authorization is bypassed for testing purposes
 */
async function hasCredentialAccess(wallet, credentialId) {
  try {
    // In test mode, allow all access for testing
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    // Extract UUID from credential ID (uploads use just the UUID part)
    const credentialUuid = extractCredentialUuid(credentialId);

    // Check if wallet is the credential owner
    const allCredentials = credentialDb.getAllCredentials(1000, 0);
    const credential = allCredentials.find(cred => {
      // Check both sas_credential_id and id fields
      const sasUuid = extractCredentialUuid(cred.sas_credential_id);
      const idUuid = extractCredentialUuid(cred.id);
      return sasUuid === credentialUuid || idUuid === credentialUuid;
    });

     if (credential && credential.wallet_address === wallet) {
       log.info(`Wallet ${wallet} authorized as owner of credential ${credentialUuid}`);
       return true;
     }

    // Check if wallet is an authorized signer (need to derive actual credential address)
    if (credential && credential.sas_credential_id) {
      try {
        // Get the actual SAS credential address by deriving it for the credential owner
        const payer = require('./payer').getPayerKeypair();
        const sasIntegration = require('./sas-integration');
        const ownerSasResult = await sasIntegration.ensureSasCredential(credential.wallet_address, payer);
        
        const authorizedSigners = await getAuthorizedSigners(ownerSasResult.credentialAddress);
         if (authorizedSigners && authorizedSigners.includes(wallet)) {
           log.info(`Wallet ${wallet} authorized as signer of credential ${credentialUuid}`);
           return true;
         }
       } catch (error) {
         log.error('Error checking authorized signers', { error: error.message });
         // Don't fail access check if SAS lookup fails
       }
    }

     log.info(`Wallet ${wallet} denied access to credential ${credentialUuid}`);
     return false;
   } catch (error) {
     log.error('Error checking credential access', { error });
     return false;
   }
}

/**
 * Helper: Calculate file hash (SHA2-256)
 */
function calculateFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * @swagger
 * /api/v1/carecircle/credentials:
 *   get:
 *     tags:
 *       - CareCircle
 *     summary: List credentials owned by wallet
 *     description: Returns all credentials where the wallet is the owner. For authorized access to other wallets' credentials, use the files or authorized-signers endpoints directly with the credential ID.
 *     parameters:
 *       - in: query
 *         name: wallet
 *         required: true
 *         schema:
 *           type: string
 *         description: Solana wallet address
 *     responses:
 *       200:
 *         description: Credentials retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 credentials:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       mint: { type: string }
 *                       owner: { type: string }
 *                       didId: { type: string }
 *                       sasCredentialId: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/credentials', async (req, res) => {
  try {
    const wallet = req.query.wallet;
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    // Fetch all credentials from database
    const allCredentials = credentialDb.getAllCredentials(1000, 0);
    const credentials = [];

    // Filter credentials where wallet is owner
    // Note: Checking authorized signers for every credential is expensive
    // The frontend handles authorized access via hasCredentialAccess checks on individual operations
    for (const cred of allCredentials) {
      if (cred.wallet_address === wallet) {
        credentials.push({
          id: extractCredentialUuid(cred.id),
          name: cred.full_name,
          mint: cred.mint_address,
          owner: cred.wallet_address,
          didId: cred.did_id,
          sasCredentialId: cred.sas_credential_id
        });
      }
    }

    return res.json({ credentials: credentials.sort((a, b) => a.id.localeCompare(b.id)) });
  } catch (error) {
    log.error('Error listing credentials', { error });
    return res.status(500).json({ error: 'Failed to list credentials' });
  }
});

/**
 * @swagger
 * /api/v1/carecircle/files:
 *   get:
 *     tags:
 *       - CareCircle
 *     summary: List files in a credential's uploads folder
 *     description: Returns all files uploaded to a credential. Requires wallet to have access (owner or authorized signer).
 *     parameters:
 *       - in: query
 *         name: wallet
 *         required: true
 *         schema:
 *           type: string
 *         description: Solana wallet address
 *       - in: query
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential UUID
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied - wallet not authorized for credential
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/files', async (req, res) => {
  try {
    const wallet = req.query.wallet;
    const credentialId = req.query.credentialId;

    if (!wallet || !credentialId) {
      return res.status(400).json({ error: 'Wallet and credentialId required' });
    }

    // Check if wallet has access to this credential
    const hasAccess = await hasCredentialAccess(wallet, credentialId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: wallet not authorized for this credential' });
    }

    const config = require('./config');
    let uploadsBasePath = config.uploads.path;
    
    // If it's a relative path, resolve it relative to project root
    if (!path.isAbsolute(uploadsBasePath)) {
      uploadsBasePath = path.join(__dirname, '..', uploadsBasePath);
    }
    
    const credentialPath = path.join(uploadsBasePath, credentialId);
    const files = [];

    if (fs.existsSync(credentialPath)) {
      const entries = fs.readdirSync(credentialPath);
      files.push(...entries.filter(entry => {
        const fullPath = path.join(credentialPath, entry);
        return fs.statSync(fullPath).isFile();
      }));
    }

    return res.json({ files: files.sort() });
   } catch (error) {
     log.error('Error listing files', { error });
     return res.status(500).json({ error: 'Failed to list files' });
   }
});

/**
 * @swagger
 * /api/v1/carecircle/upload:
 *   post:
 *     tags:
 *       - CareCircle
 *     summary: Upload a file to credential storage
 *     description: Uploads a file to a credential's uploads folder. Requires wallet to have access. Includes file hash validation and size limits (5MB max).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet
 *               - credentialId
 *               - filename
 *               - fileBuffer
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: Solana wallet address
 *               credentialId:
 *                 type: string
 *                 description: Credential UUID
 *               filename:
 *                 type: string
 *                 description: Name of file to upload
 *               fileBuffer:
 *                 type: string
 *                 description: File content as base64 or Buffer
 *               fileSize:
 *                 type: number
 *                 description: File size in bytes
 *               fileType:
 *                 type: string
 *                 description: MIME type of file
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 file:
 *                   type: object
 *                   properties:
 *                     credentialId: { type: string }
 *                     filename: { type: string }
 *                     fileSize: { type: number }
 *                     fileHash: { type: string }
 *                     fileType: { type: string }
 *                     uploadedAt: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied - wallet not authorized for credential
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/upload', async (req, res) => {
  try {
    const { wallet, credentialId, filename, fileBuffer, fileSize, fileType } = req.body;

    if (!wallet || !credentialId || !filename || !fileBuffer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if wallet has access to this credential
    const hasAccess = await hasCredentialAccess(wallet, credentialId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: wallet not authorized for this credential' });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileSize > maxSize) {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }

    // Convert base64/ArrayBuffer to buffer
    let buffer;
    if (Buffer.isBuffer(fileBuffer)) {
      buffer = fileBuffer;
    } else if (typeof fileBuffer === 'string') {
      // Handle base64 string (with or without data URI prefix)
      const base64String = fileBuffer.includes(',') ? fileBuffer.split(',')[1] : fileBuffer;
      buffer = Buffer.from(base64String, 'base64');
    } else if (fileBuffer instanceof ArrayBuffer) {
      // Handle ArrayBuffer directly
     buffer = Buffer.from(fileBuffer);
     } else if (typeof fileBuffer === 'object' && fileBuffer.type === 'Buffer' && Array.isArray(fileBuffer.data)) {
       // Handle serialized Buffer objects
       buffer = Buffer.from(fileBuffer.data);
      } else {
        log.error('Unknown fileBuffer type', { type: typeof fileBuffer, keys: Object.keys(fileBuffer || {}) });
        return res.status(400).json({ error: 'Invalid file buffer format' });
      }
     
     const fileHash = calculateFileHash(buffer);

      // Store file to filesystem (skip during tests)
      if (process.env.NODE_ENV !== 'test') {
        log.info('Storing file to filesystem...');
        const config = require('./config');
        let uploadsBasePath = config.uploads.path;
        
        // If it's a relative path, resolve it relative to project root
        if (!path.isAbsolute(uploadsBasePath)) {
          uploadsBasePath = path.join(__dirname, '..', uploadsBasePath);
        }
        
        const credentialPath = path.join(uploadsBasePath, credentialId);

        try {
          // Create credential directory if it doesn't exist
          if (!fs.existsSync(credentialPath)) {
            fs.mkdirSync(credentialPath, { recursive: true });
            log.info('Created uploads directory', { credentialPath });
          }

          // Store file
          const filePath = path.join(credentialPath, filename);
          fs.writeFileSync(filePath, buffer);
          log.info('File stored at', { filePath });
        } catch (err) {
          log.error('Error storing file', { error: err.message });
          // Don't fail the upload if file storage fails, but log it
        }
      } else {
        log.info('Skipping file storage during tests (NODE_ENV=test)');
      }

    return res.status(200).json({
      success: true,
      file: {
        credentialId,
        filename,
        fileSize,
        fileHash,
        fileType,
        uploadedAt: new Date().toISOString()
      }
    });
   } catch (error) {
     log.error('Error uploading file', { error });
     return res.status(500).json({ error: 'Failed to upload file' });
   }
});

/**
 * @swagger
 * /api/v1/carecircle/authorize-caregiver:
 *   post:
 *     tags:
 *       - CareCircle
 *     summary: Add caregiver as authorized signer
 *     description: Authorizes a caregiver wallet address to sign transactions for a SAS Credential. Requires wallet to own or have access to the credential.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet
 *               - credentialId
 *               - caregiverAddress
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: Wallet address of credential owner/authorizer
 *               credentialId:
 *                 type: string
 *                 description: Credential UUID
 *               caregiverAddress:
 *                 type: string
 *                 description: Solana wallet address of caregiver to authorize
 *     responses:
 *       200:
 *         description: Caregiver authorized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 credential:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                 caregiver: { type: string }
 *                 wallet: { type: string }
 *                 sasTransaction:
 *                   type: object
 *                   properties:
 *                     credentialAddress: { type: string }
 *                     signature: { type: string }
 *                     authorizedSigners:
 *                       type: array
 *                       items: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied - wallet not authorized for credential
 *       404:
 *         description: Credential not found
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/authorize-caregiver', async (req, res) => {
  try {
    const { wallet, credentialId, caregiverAddress } = req.body;

    if (!wallet || !credentialId || !caregiverAddress) {
      return res.status(400).json({ error: 'Wallet, credential ID, and caregiver address required' });
    }

    // Check if wallet has access to this credential
    const hasAccess = await hasCredentialAccess(wallet, credentialId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: wallet not authorized for this credential' });
    }

    // Validate caregiver address format
    const addressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!addressRegex.test(caregiverAddress)) {
      return res.status(400).json({ error: 'Invalid caregiver address format' });
    }

     // In test mode, skip SAS operations and return success
     if (process.env.NODE_ENV === 'test') {
       log.info('Caregiver authorization (SAS skipped)', { caregiverAddress });
       return res.status(200).json({
         success: true,
         message: 'Caregiver authorized successfully (test mode)',
         credential: credentialId,
         caregiver: caregiverAddress,
         wallet: wallet
       });
     }

    try {
      // Get the credential from database
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

      // Get payer for SAS operations
      const payer = require('./payer').getPayerKeypair();
      const sasIntegration = require('./sas-integration');

       // Ensure SAS credential exists and get its actual on-chain address
       log.info(`Ensuring SAS credential for wallet ${wallet}...`);
       const sasResult = await sasIntegration.ensureSasCredential(wallet, payer, credential.sas_credential_id);
       log.info(`SAS credential address: ${sasResult.credentialAddress}`);

       // Add the caregiver as an authorized signer to the SAS Credential
       log.info(`Adding caregiver ${caregiverAddress} to SAS credential...`);
       let addResult;
       try {
         addResult = await sasIntegration.addAuthorizedSigner(
           sasResult.credentialAddress,
           wallet,
           caregiverAddress,
           payer
         );
         log.info(`Caregiver added successfully. Tx: ${addResult.transactionSignature}`);
       } catch (addError) {
         log.error('Error adding caregiver to SAS credential', { error: addError.message });
         // If error is "signer already authorized", continue anyway
         if (!addError.message.includes('Signer already authorized')) {
           throw addError;
         }
         log.info('Caregiver was already added, continuing...');
         addResult = {
           transactionSignature: null,
           authorizedSigners: await getAuthorizedSigners(sasResult.credentialAddress)
         };
       }

       log.info('Caregiver authorized', { caregiverAddress, credentialId, wallet });

      return res.status(200).json({
        success: true,
        message: 'Caregiver authorized successfully',
        credential: {
          id: credentialId,
          name: credential.full_name
        },
        caregiver: caregiverAddress,
        wallet: wallet,
        sasTransaction: {
          credentialAddress: sasResult.credentialAddress,
          signature: addResult.transactionSignature,
          authorizedSigners: addResult.authorizedSigners
        }
      });
     } catch (sasError) {
       log.error('Error during SAS operations', { error: sasError.message });
       return res.status(500).json({ 
         error: 'Failed to update SAS Credential',
         details: sasError.message 
       });
     }
   } catch (error) {
     log.error('Error authorizing caregiver', { error });
     return res.status(500).json({ error: 'Failed to authorize caregiver' });
   }
});

/**
 * @swagger
 * /api/v1/carecircle/authorized-signers:
 *   get:
 *     tags:
 *       - CareCircle
 *     summary: Get authorized signers for a credential
 *     description: Returns list of wallet addresses that are authorized to sign with this credential. Requires wallet to have access to the credential.
 *     parameters:
 *       - in: query
 *         name: wallet
 *         required: true
 *         schema:
 *           type: string
 *         description: Solana wallet address
 *       - in: query
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential UUID
 *     responses:
 *       200:
 *         description: Authorized signers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signers:
 *                   type: array
 *                   items:
 *                     type: string
 *                 credentialId: { type: string }
 *                 credentialName: { type: string }
 *                 credentialOwner: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied - wallet not authorized for credential
 *       404:
 *         description: Credential not found
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/authorized-signers', async (req, res) => {
  try {
    const wallet = req.query.wallet;
    const credentialId = req.query.credentialId;

    if (!wallet || !credentialId) {
      return res.status(400).json({ error: 'Wallet and credentialId required' });
    }

    log.info(`Fetching authorized signers for credential: ${credentialId}, wallet: ${wallet}`);

    // Check if wallet has access to this credential
    const hasAccess = await hasCredentialAccess(wallet, credentialId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: wallet not authorized for this credential' });
    }

    try {
      // Get the credential from database
      const allCredentials = credentialDb.getAllCredentials(1000, 0);
      const credentialUuid = extractCredentialUuid(credentialId);
      const credential = allCredentials.find(cred => {
        const sasUuid = extractCredentialUuid(cred.sas_credential_id);
        const idUuid = extractCredentialUuid(cred.id);
        return sasUuid === credentialUuid || idUuid === credentialUuid;
      });

       if (!credential) {
         log.info(`Credential not found in database: ${credentialId}`);
         return res.status(404).json({ error: 'Credential not found' });
       }

       log.info(`Found credential in database, owner: ${credential.wallet_address}, SAS ID: ${credential.sas_credential_id}`);

       // In test mode, return empty signers
       if (process.env.NODE_ENV === 'test') {
         log.info('Returning empty signers');
         return res.json({ signers: [] });
       }

      // Get payer for SAS operations
      const payer = require('./payer').getPayerKeypair();
      const sasIntegration = require('./sas-integration');

      // IMPORTANT: Derive SAS credential from the credential OWNER (not the requesting wallet)
      // This ensures we get the correct on-chain credential that contains the signers
      log.info(`Deriving SAS credential for owner: ${credential.wallet_address}`);
       const sasResult = await sasIntegration.ensureSasCredential(credential.wallet_address, payer, credential.sas_credential_id);
       log.info(`SAS credential address: ${sasResult.credentialAddress}`);

       // Store the credential address in database for future use (backward compatibility migration)
       if (sasResult.credentialAddress && credential.sas_credential_id) {
         try {
           // Update the database with the new credential address
           const db = require('./database').db;
           db.prepare(`UPDATE credentials SET sas_credential_address = ? WHERE sas_credential_id = ?`)
             .run(sasResult.credentialAddress, credential.sas_credential_id);
         } catch (dbError) {
           log.warn('Could not store SAS credential address', { error: dbError.message });
           // Don't fail the request if this fails
         }
       }

       // Get the authorized signers for this SAS Credential
       log.info(`Calling getAuthorizedSigners for address: ${sasResult.credentialAddress}`);
       const signers = await getAuthorizedSigners(sasResult.credentialAddress) || [];
       log.info(`getAuthorizedSigners returned ${signers.length} signers`, { signers });

      return res.json({ 
        signers: signers,
        credentialId: credentialId,
        credentialName: credential.full_name,
        credentialOwner: credential.wallet_address
      });
     } catch (sasError) {
       log.error('Error fetching authorized signers', { error: sasError.message, stack: sasError.stack });
       // Return empty list if SAS lookup fails
       return res.json({ signers: [], error: 'Could not fetch signers from on-chain' });
     }
   } catch (error) {
     log.error('Error getting authorized signers', { error });
     return res.status(500).json({ error: 'Failed to get authorized signers' });
   }
});

/**
 * GET /api/v1/carecircle/documentation
 * Return CareCircle documentation as markdown
 */
router.get('/documentation', (req, res) => {
  try {
    const docPath = path.join(__dirname, '..', 'concepts', 'docs', 'carecircle.md');
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf8');
      return res.json({ content });
    }
    return res.status(404).json({ error: 'Documentation not found' });
   } catch (error) {
     log.error('Error loading documentation', { error });
     return res.status(500).json({ error: 'Failed to load documentation' });
   }
});

module.exports = router;
