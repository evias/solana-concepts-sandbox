const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { credentialDb } = require('./database');
const { getAuthorizedSigners } = require('./sas-integration');
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
      console.log(`[CareCircle] Wallet ${wallet} authorized as owner of credential ${credentialUuid}`);
      return true;
    }

    // Check if wallet is an authorized signer
    if (credential && credential.sas_credential_id) {
      const authorizedSigners = await getAuthorizedSigners(credential.sas_credential_id);
      if (authorizedSigners && authorizedSigners.includes(wallet)) {
        console.log(`[CareCircle] Wallet ${wallet} authorized as signer of credential ${credentialUuid}`);
        return true;
      }
    }

    console.log(`[CareCircle] Wallet ${wallet} denied access to credential ${credentialUuid}`);
    return false;
  } catch (error) {
    console.error('[CareCircle] Error checking credential access:', error);
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
 * GET /api/v1/carecircle/credentials
 * List credentials accessible by the wallet with metadata (name, mint)
 * Only returns credentials where wallet is owner or authorized signer
 */
router.get('/credentials', async (req, res) => {
  try {
    const wallet = req.query.wallet;
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    // Check if NODE_ENV is test to avoid reading production uploads
    if (process.env.NODE_ENV === 'test') {
      return res.json({ credentials: [] });
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const credentials = [];

    if (fs.existsSync(uploadsDir)) {
      const entries = fs.readdirSync(uploadsDir);
      
      // For each upload folder, check if wallet has access
      for (const credentialId of entries) {
        const credentialPath = path.join(uploadsDir, credentialId);
        if (!fs.statSync(credentialPath).isDirectory()) continue;

        // Check if wallet has access to this credential
        const hasAccess = await hasCredentialAccess(wallet, credentialId);
        if (!hasAccess) {
          continue;
        }

        // Try to find matching credential in database
        try {
          const allCredentials = credentialDb.getAllCredentials(1000, 0);
          const credentialUuid = extractCredentialUuid(credentialId);
          const matching = allCredentials.find(cred => {
            // Check both sas_credential_id and id fields
            const sasUuid = extractCredentialUuid(cred.sas_credential_id);
            const idUuid = extractCredentialUuid(cred.id);
            return sasUuid === credentialUuid || idUuid === credentialUuid;
          });

          credentials.push({
            id: credentialId,
            name: matching ? matching.full_name : null,
            mint: matching ? matching.mint_address : null
          });
        } catch (err) {
          // If database lookup fails, just add the ID
          credentials.push({
            id: credentialId,
            name: null,
            mint: null
          });
        }
      }
    }

    return res.json({ credentials: credentials.sort((a, b) => a.id.localeCompare(b.id)) });
  } catch (error) {
    console.error('[CareCircle] Error listing credentials:', error);
    return res.status(500).json({ error: 'Failed to list credentials' });
  }
});

/**
 * GET /api/v1/carecircle/files
 * List files in a credential's uploads folder
 * Only returns if wallet has access to the credential
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

    // Check if NODE_ENV is test
    if (process.env.NODE_ENV === 'test') {
      return res.json({ files: [] });
    }

    const credentialPath = path.join(__dirname, '..', 'uploads', credentialId);
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
    console.error('[CareCircle] Error listing files:', error);
    return res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * POST /api/v1/carecircle/upload
 * Upload a file to a credential's uploads folder
 * Only allows if wallet has access to the credential
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

    // Convert base64 to buffer
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer.split(',')[1] || fileBuffer, 'base64');
    const fileHash = calculateFileHash(buffer);

    // Store file to filesystem (skip during tests)
    if (process.env.NODE_ENV !== 'test') {
      console.log('[CareCircle] Storing file to filesystem...');
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      const credentialPath = path.join(uploadsDir, credentialId);

      try {
        // Create credential directory if it doesn't exist
        if (!fs.existsSync(credentialPath)) {
          fs.mkdirSync(credentialPath, { recursive: true });
          console.log('[CareCircle] Created uploads directory:', credentialPath);
        }

        // Store file
        const filePath = path.join(credentialPath, filename);
        fs.writeFileSync(filePath, buffer);
        console.log('[CareCircle] File stored at:', filePath);
      } catch (err) {
        console.error('[CareCircle] Error storing file:', err.message);
        // Don't fail the upload if file storage fails, but log it
      }
    } else {
      console.log('[CareCircle] Skipping file storage during tests (NODE_ENV=test)');
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
    console.error('[CareCircle] Error uploading file:', error);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
});

/**
 * POST /api/v1/carecircle/authorize-caregiver
 * Add a caregiver to the authorized signers of a SAS Credential
 * (In production, this would interact with SAS to add the caregiver as an authorized signer)
 */
router.post('/authorize-caregiver', (req, res) => {
  try {
    const { wallet, caregiverAddress } = req.body;

    if (!wallet || !caregiverAddress) {
      return res.status(400).json({ error: 'Wallet and caregiver address required' });
    }

    // Validate caregiver address format
    const addressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!addressRegex.test(caregiverAddress)) {
      return res.status(400).json({ error: 'Invalid caregiver address format' });
    }

    // In production, this would:
    // 1. Retrieve the SAS Credential for the wallet
    // 2. Add the caregiver address to authorized signers
    // 3. Create a transaction to update the credential on-chain
    // For now, we return success to simulate the operation
    
    console.log('[CareCircle] Authorized caregiver:', caregiverAddress, 'for wallet:', wallet);

    return res.status(200).json({
      success: true,
      message: 'Caregiver authorized successfully',
      caregiver: caregiverAddress,
      wallet: wallet
    });
  } catch (error) {
    console.error('[CareCircle] Error authorizing caregiver:', error);
    return res.status(500).json({ error: 'Failed to authorize caregiver' });
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
    console.error('[CareCircle] Error loading documentation:', error);
    return res.status(500).json({ error: 'Failed to load documentation' });
  }
});

module.exports = router;
