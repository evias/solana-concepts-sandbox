# HealthCred - Healthcare Worker Credentials Registry

HealthCred is a decentralized registry for healthcare worker credentials and achievements, powered by Solana blockchain and DID (Decentralized Identifier) documents.

## Features

### Register Your Credential

Healthcare workers can register their professional credentials by providing:
- **Full Name**: Your official name
- **Date of Birth**: For verification purposes
- **Email Address**: Contact information
- **Professional Title**: Your role (e.g., Dentist, Nurse, Doctor)
- **DID Document**: A W3C-compliant DID document containing:
  - Unique `id` field (e.g., `did:healthcred:12345abc`)
  - `authentication` array with your authentication keys

Upon registration, a unique credential is created and:
- Stored on-chain with full DID document in a memo transaction
- Assigned a SHA2-256 hash for data integrity verification
- Linked to an SPL token mint for On-chain verification

**Note**: Each wallet address can only have one active credential.

### Earn Badges

Other professionals can send you badges recognizing your achievements:
- **Emoji Badge**: Select from 10+ available emojis (⭐, 💯, 🏆, 🎖️, 👑, ✨, 🌟, 🔥, 💎, 🚀)
- **Description**: Text description of the achievement (e.g., "Excellent patient care")
- **On-Chain Record**: Each badge creates an SPL token and transaction memo for permanent verification

Each badge:
- Records the issuer's wallet address (audit trail)
- Is immutable and verifiable on Solana devnet
- Links to a Solscan transaction for transparency

### Upload Certifications

Document your professional qualifications by uploading certification files:
- **Supported Formats**: PDF, PNG, JPG
- **File Processing**: 
  - Calculates SHA2-256 hash of file content
  - Creates on-chain transaction memo with filename and hash
  - Stores file metadata for audit trail

Each certification:
- Requires you to sign the transaction with your connected wallet
- Creates an SPL token mint
- Is verifiable via the on-chain memo containing the file hash
- Records issuer wallet for accountability

### View Registered Credentials

Browse all registered healthcare workers:
- 3-column responsive grid layout
- Shows name, profession, email, and badge count
- Pagination support for large credential sets
- Quick access to send badges or view full details

### Download DID Documents

Access DID documents programmatically:
- **Endpoint**: `/api/v1/healthcred/did/:didId`
- **Response Format**: `application/did+json`
- **Use Case**: Credential verification systems can fetch and validate DID documents

## How to Use

1. **Connect Your Wallet**: Click "Connect Wallet" and approve Phantom wallet connection
2. **Register Credential**: Fill in your professional information and DID document
3. **Verify On-Chain**: Use Solscan to verify your credential and transaction memo
4. **Receive Badges**: Other professionals can send you achievement badges
5. **Upload Certifications**: Document your qualifications by uploading files
6. **Share**: Direct others to your credential or download your DID document

## On-Chain Data

All HealthCred data is recorded on Solana devnet with:
- **Memo Transactions**: Full DID documents and badge/certification metadata stored in transaction memos
- **SPL Token Mints**: One token issued per credential, badge, and certification for reference
- **Solscan Links**: All transactions are verifiable at [Solscan](https://solscan.io/?cluster=devnet)

## DID Document Example

```json
{
  "id": "did:healthcred:nurse123",
  "authentication": [
    "did:healthcred:nurse123#key-1",
    "did:healthcred:nurse123#key-2"
  ],
  "context": "https://www.w3.org/ns/did/v1"
}
```

## Privacy & Security

- **DID Document Hash**: SHA2-256 hash of your complete DID document is stored for integrity verification
- **Wallet Ownership**: Credentials are linked to your connected wallet address
- **Immutable Records**: All uploaded certifications and badges cannot be modified or deleted
- **Audit Trail**: Issuer wallet addresses are recorded with each badge and certification

## Limitations

- **One Credential Per Wallet**: Each wallet can only register one healthcare credential
- **Devnet Only**: Currently operates on Solana devnet (not mainnet)
- **File Size**: Large certification files may require higher compute budgets
- **DID Format**: DID documents must be valid JSON with required `id` and `authentication` fields

## Technical Details

- **Compute Budget**: 300k CUs for credential registration, 200k CUs for badges/certifications
- **File Hashing**: SHA2-256 for all uploaded files
- **Memo Program**: `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
- **Token Standard**: SPL tokens with 9 decimals

## FAQ

**Q: What happens if I lose access to my wallet?**
A: Your credential on-chain is permanent. You can register with a new wallet to create a new credential.

**Q: Can I update my credential information?**
A: Currently, credentials cannot be modified. Register a new credential with updated information if needed.

**Q: Are my credentials visible to everyone?**
A: Yes, all registered credentials are public on the blockchain. Only the metadata is visible; your full DID document can be downloaded via the dedicated endpoint.

**Q: How long does registration take?**
A: Registration is typically confirmed within 15-30 seconds after signing the transaction.

**Q: Can I download badges and certifications?**
A: Badges and certifications are stored on-chain in transaction memos. Use Solscan to access the full data via transaction hashes.
