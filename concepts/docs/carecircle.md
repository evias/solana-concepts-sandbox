# CareCircle Documentation

## Overview

CareCircle is a secure file sharing and caregiver delegation system built on Solana. It enables healthcare providers, patients, and their caregivers to securely share documents and manage access permissions through a simple, blockchain-backed interface.

## Key Features

### 1. Credential Uploads Browser
Browse and organize files stored in your credentials' upload folders. The filesystem-style interface lets you navigate through credentials and view files at a glance.

**How it works:**
- Connect your wallet to view credentials you own or have access to (through SAS)
- Click on a credential folder to see uploaded files
- Use the ".." button to navigate back to the credential list

### 2. File Upload
Upload documents, images, spreadsheets, and videos to your credentials' storage folders. Files are persisted to disk for permanent access.

**Supported file types:**
- Documents: PDF, DOCX, DOC, XLSX, XLS, CSV, JSON, YAML, TXT, MD
- Media: JPG, PNG, GIF, MP4

**Requirements:**
- Maximum file size: 5MB
- File is stored in the selected credential's uploads folder
- Upload creates a transaction memo on-chain recording the file metadata

**File metadata stored:**
- Filename
- File size
- SHA2-256 hash
- Upload timestamp
- Uploader wallet address

### 3. Caregiver Authorization
Grant other wallet addresses access to your credentials and files. Authorized caregivers become signers on your SAS Credential and can view and upload files in your shared credential.

**How it works:**
1. Click "Authorize a Caregiver"
2. Enter the caregiver's Solana wallet address
3. Submit the form
4. The caregiver is added as an authorized signer to your SAS Credential
5. After a page reload, the caregiver can access your credential's files
6. Caregivers can view files and upload new documents (same permissions as owner)

**Use cases:**
- Grant family members access to health documents
- Allow medical professionals to view and add patient notes to records
- Share care instructions and updates with assistants
- Enable emergency contact access during crises
- Allow multiple team members to collaborate on shared care documentation

## Workflow Examples

### Scenario 1: Patient Sharing Health Records
1. Patient connects wallet and uploads medical documents (lab results, prescriptions)
2. Patient authorizes their spouse as a caregiver
3. Spouse logs in with their wallet and can now view the shared documents
4. Spouse can also upload additional notes or documents
5. Documents remain secure on Solana while physically stored on server

### Scenario 2: Multi-provider Care Team
1. Primary physician creates a credential and uploads care plan
2. Authorizes specialist, nurse, and home health aide as caregivers
3. Each team member can access the credential and upload their own notes
4. All documents are timestamped and attributable to their uploader
5. Only the credential owner and authorized signers can access the files

## Technical Details

### Storage Architecture
- Files are stored in `/uploads/{credentialId}/{filename}`
- Each credential has its own folder
- File organization follows the credential UUID structure
- SHA2-256 hashing ensures file integrity

### Authorization Model
- **Credential Owner**: Wallet address that registered/created the credential. Full access to all features.
- **Authorized Signers**: Wallet addresses added via the authorization endpoint. Get added to the credential's SAS (Solana Attestation Service) Credential as authorized signers.
- **Access Control**: File access is verified against:
  1. Credential ownership (wallet_address in database)
  2. SAS Credential authorized signers list

### Transaction Memos
When files are uploaded, a transaction memo is created:
```
{wallet} file upload: {filename} - {fileHash} (SHA2-256)
```

This provides an immutable, on-chain record of file uploads without requiring token mints.

### SAS Integration
- Each credential owner gets one SAS Credential (Solana Attestation Service)
- Caregivers are added as authorized signers to the owner's SAS Credential
- File access is controlled through SAS authorization rules
- Multiple caregivers can be authorized, each with individual wallet addresses
- The SAS Credential address is derived deterministically from the wallet address

## Security Considerations

### Private Keys
- Always use a secure wallet (Phantom, Ledger, etc.)
- Never share your private keys or seed phrases
- Be cautious when entering manual wallet addresses

### File Access
- Only wallet owners and authorized caregivers can access files
- File access is controlled at the SAS Credential level
- Each access is verified against the credential owner and authorized signers list
- Revoking caregiver access requires removing them from the SAS Credential (future feature)

### Wallet Verification
- Wallet addresses must be valid Solana addresses (32-44 base58 characters)
- Wallet ownership is verified through Phantom wallet connection
- Always verify you're using the correct wallet account

### File Integrity
- All files are hashed with SHA2-256 to ensure integrity
- Hashes are recorded in transaction memos on-chain
- You can verify file authenticity by comparing hashes

### Caregiver Authorization
- Only the credential owner can authorize caregivers
- Authorization adds the caregiver's wallet to the SAS Credential
- Authorized caregivers have the same file access as the owner (read, upload, delete)

## Troubleshooting

### "No credentials accessible"
- Make sure you have at least one credential or have been added as a caregiver
- Check that you're using the correct wallet address
- Try clicking "Refresh" to reload the credentials list

### "File upload failed"
- Verify file size is under 5MB
- Check that the file type is supported (PDF, DOCX, etc.)
- Ensure you selected a credential
- Try uploading again

### "Authorization failed"
- Double-check the caregiver's wallet address (32-44 base58 characters)
- Verify the address is for a valid Solana wallet
- Try clicking the form to close and reopen it
- Check browser console for error details

## Support

For issues or questions, refer to the main concept sandbox documentation or contact the dHealth team.
