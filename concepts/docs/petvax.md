# PetVax - Proof of Immunization

A system to record and verify vaccination records for pets registered in PetTracker. Each vaccination is cryptographically linked to exactly one pet and can be issued by authorized veterinary clinics. All vaccinations are recorded on the Solana blockchain using two distinct verification methods: SPL Token Mints for initial vaccinations and Vaccine Transactions (via memo program) for renewal shots.

## Architecture

- **Frontend**: Alpine.js + Tailwind CSS with Phantom wallet integration
- **Backend**: Express.js + SQLite with foreign key constraints  
- **Blockchain**: Solana devnet with full transaction submission
- **Integration**: Linked to PetTracker pet registry via foreign keys
- **On-Chain Methods**: 
  - **SPL Token Mint**: Creates a unique SPL token for each initial vaccination (immutable on-chain proof)
  - **Vaccine Transaction (Shot)**: Records renewal shots with memo data via memo program (signed transaction)

## Key Features

### 1. Dual On-Chain Verification Methods

PetVax supports two types of vaccination records, both cryptographically verified on Solana:

#### SPL Token Mint (Type: `spl_token_mint`)
- **Used for**: Initial vaccination record creation
- **Verification**: Creates a unique SPL token mint on Solana blockchain
- **Status Badge**: 🔐 **On-Chain** (purple badge)
- **Icon**: ✙ (mint symbol)
- **Database Field**: `mint_address` contains the SPL token mint public key
- **Proof**: Token exists immutably on blockchain, verifiable through token account
- **Actions**: Can record renewal shots after initial vaccination

#### Vaccine Tx (Shot) (Type: `vaccine_tx_shot`)
- **Used for**: Renewal vaccination records (follow-up shots)
- **Verification**: Signed transaction with vaccination memo data via memo program
- **Status Badge**: ✓ **Signed** (blue badge)
- **Icon**: 💉 (syringe symbol)
- **Database Field**: `transaction_hash` contains the memo program transaction hash
- **Proof**: Message and transaction signature stored, memo data visible on Solscan
- **Data**: Complete vaccination details + renewal schedule stored in `notes` field as JSON memo

### 2. Transaction Flow

#### Initial Vaccination (SPL Token Mint):
1. **Connect Wallet**: User connects Phantom wallet
2. **Select Pet**: Choose pet from PetTracker registry
3. **Enter Details**: Vaccine name, date, vet address, optional notes
4. **Sign**: Phantom opens to approve SPL token creation
5. **Submit**: Frontend submits minting transaction to Solana devnet
6. **Mint Created**: Unique SPL token mint generated and stored in `mint_address`
7. **Record**: Vaccination saved with token mint and owner verified

#### Renewal Shot (Vaccine Tx):
1. **Select Pet**: Choose pet with existing vaccination
2. **Record New Shot**: Click on vaccination row → "New Shot" button (only on SPL Token Mint rows)
3. **Enter Renewal Info**: 
   - Must Renew checkbox
   - Renewal period (monthly/quarterly/yearly/custom)
   - Optional vaccine URL, clinic URL
4. **Sign Message**: User signs with pet signature: "Hello, I am the pet named {petName}, this is my noseprint!"
5. **Prepare Transaction**: Backend creates memo transaction with all vaccination data
6. **Sign & Send**: Phantom signs and user confirms transaction
7. **Record Memo**: Transaction recorded with:
   - `transaction_hash`: Memo program transaction signature
   - `notes`: Complete memo data as JSON including renewal schedule
   - `mint_address`: NULL (distinguishes from SPL Token Mint type)

### 3. Vaccination History Display

The vaccination table shows all records with type differentiation:

| Type | Icon | Badge | Status | Fields |
|------|------|-------|--------|--------|
| SPL Token Mint | ✙ | ⛓ SPL Token Mint | 🔐 On-Chain | `mint_address`, `transaction_hash` |
| Vaccine Tx (Shot) | 💉 | 📝 Vaccine Tx (Shot) | ✓ Signed | `transaction_hash`, `notes` (JSON memo) |

### 4. Vaccination Details Modal

Users can view formatted details for any vaccination:
- **Type Badge**: Shows vaccination type with icon
- **Vaccine Info**: Name, date, veterinary clinic
- **Token Mint Address**: (if SPL Token Mint type)
- **Transaction Signature**: (if available)
- **Transaction Hash**: (if available)
- **Memo Data / Notes**: Formatted JSON display of:
  - For SPL Mints: Any notes entered at creation
  - For Vaccine Tx: Complete memo structure with renewal schedule, pet signature, URLs
- **Solscan Link**: Direct link to view transaction on blockchain

### 5. Memo Data Structure

For `vaccine_tx_shot` type vaccinations, the `notes` field contains JSON memo data:

```json
{
  "type": "vaccination_renewal_record",
  "petId": "pet_1621234567890",
  "petName": "Max",
  "petOwner": "owner_wallet_address",
  "vaccineName": "Rabies",
  "vaccinationDate": "2026-05-24",
  "vetAddress": "vet_wallet_address",
  "mustRenew": true,
  "renewalPeriod": "yearly",
  "customRenewalPeriod": null,
  "vaccinationToken": "original_mint_address",
  "vaccineUrl": "https://...",
  "clinicUrl": "https://...",
  "petSignature": "hex_encoded_pet_signature",
  "recordedAt": "2026-05-24T15:30:00.000Z"
}
```

### 6. Foreign Key Integrity
- Every vaccination record is linked to exactly one pet from PetTracker
- Database enforces referential integrity with `ON DELETE CASCADE`
- Cannot create vaccination for non-existent pets

### 7. Veterinary Authorization
- Veterinary clinics use Solana wallet addresses to identify themselves
- Vet address stored with each vaccination record for accountability
- Mandate-based system allows future authorization contracts

### 8. Pet Selection
- Users can only record vaccinations for registered pets
- Pet list fetched from PetTracker registry
- Visual confirmation of selected pet details

### 9. Vaccination Verification
- Pet owners and third parties can verify vaccination history
- Complete vaccination timeline for each pet
- Direct link to on-chain proof via Solscan for all vaccinations
- Memo data viewable directly in details modal for renewal shots

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Fund Your Payer Wallet (if using Solana tokens)

When you first start the server, a backend payer wallet is created:

```bash
npm start
# Note the payer address in console output
# Fund it: https://faucet.solana.com (2-5 SOL recommended for testing)
```

### 3. Set Up HTTPS (for Wallet Connections)

Phantom and other Solana wallets require HTTPS. For development with ngrok:

```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Expose via ngrok (in another terminal)
ngrok http 3000
# Copy the ngrok HTTPS URL: https://xxxx-xx-xxx-xxx-xx.ngrok-free.app
```

Visit the ngrok HTTPS URL in your browser.

### 4. Connect Your Wallet

1. Click "Connect Wallet" in the app
2. Select Phantom (or your installed wallet)
3. Approve the connection
4. Your wallet address appears in the header

### 5. Record an Initial Vaccination (SPL Token Mint)

1. Connect your wallet (Phantom)
2. Select a pet from the PetTracker registry
3. Enter vaccination details:
   - Vaccine name (e.g., Rabies, DPPE, Lepto)
   - Vaccination date
   - Veterinary clinic Solana address
   - Optional notes
4. Click "Record Vaccination with On-Chain Proof"
5. Follow the steps:
   - **Sign**: Phantom opens for message signing
   - **Create Token**: Backend creates unique SPL token mint
   - **Record**: Vaccination saved with `mint_address` pointing to the token
6. Result: Vaccination with **✙ SPL Token Mint** type (🔐 On-Chain status)

### 6. Record a Renewal Shot (Vaccine Tx)

1. Navigate to an existing pet's vaccination history
2. Find the initial vaccination (marked with ✙ icon)
3. Click "📋 New Shot" button (only appears on SPL Token Mint type)
4. Enter renewal details:
   - Must Renew checkbox (optional)
   - Renewal period: monthly, quarterly, yearly, or custom
   - Optional vaccine URL and clinic URL
5. Click "Record Shot"
6. Follow the steps:
   - **Sign Pet Message**: Phantom signs "Hello, I am the pet named {petName}, this is my noseprint!"
   - **Prepare Transaction**: Backend creates memo transaction with all renewal data
   - **Sign & Send**: Phantom signs and sends transaction
   - **Record**: Vaccination saved with memo data in `notes` field
7. Result: Vaccination with **💉 Vaccine Tx (Shot)** type (✓ Signed status)

### 7. View Vaccination Details

1. In the vaccination history table, click "📋 View Details" on any row
2. Modal shows:
   - **Type**: SPL Token Mint or Vaccine Tx (Shot)
   - **Vaccine Info**: Name, date, veterinary clinic
   - **Token Mint Address**: (only for SPL Token Mint type)
   - **Transaction Hash**: (for both types)
   - **Memo Data / Notes**: 
     - Formatted JSON display for Vaccine Tx (Shot)
     - Plain text for SPL Token Mint
   - **Record Created**: Timestamp
   - **Solscan Link**: Direct link to view on blockchain

### 8. Verify Vaccinations

1. Select a pet to view its vaccination history
2. See all recorded vaccinations with icons and status:
   - **✙ SPL Token Mint** (purple badge 🔐 On-Chain) - initial vaccination with token mint
   - **💉 Vaccine Tx (Shot)** (blue badge ✓ Signed) - renewal shot with memo data
3. Click "🔗 Solscan" to see the transaction on the blockchain explorer

## Project Structure

```
├── api/
│   ├── petvax.js              # Express API routes
│   ├── pettracker.js          # PetTracker integration
│   ├── database.js            # SQLite database layer (vaccinations table)
│   ├── solana-tokens.js       # Solana token operations
│   └── payer.js               # Backend payer keypair management
├── concepts/
│   ├── petvax.html            # Frontend (Alpine.js)
│   └── docs/
│       └── petvax.md          # This documentation
├── __tests__/
│   ├── petvax.test.js         # Vaccination tests
│   ├── pettracker.test.js     # PetTracker integration tests
│   └── solana-tokens.test.js  # Token operations tests
├── pettracker.db              # SQLite database (includes vaccinations table)
└── .payer-keypair.json        # Backend wallet (created on first run, gitignored)
```

## Database Schema

### Vaccinations Table

The `vaccinations` table stores:
- `id` - Unique vaccination record identifier
- `pet_id` - Foreign key to pets table (enforces referential integrity)
- `vaccine_name` - Type of vaccine (e.g., Rabies, DPPE, Lepto)
- `vaccination_date` - Date of vaccination
- `vet_address` - Solana address of veterinary clinic
- `vet_mandate_authority` - Authority allowed to record this vaccination
- `notes` - Vaccination notes or JSON memo data:
  - **For SPL Token Mint**: Optional text notes
  - **For Vaccine Tx (Shot)**: Complete JSON memo structure with pet signature, renewal schedule, URLs
- `mint_address` - SPL token mint address (set only for `spl_token_mint` type, NULL for `vaccine_tx_shot`)
- `transaction_signature` - Digital signature from Phantom wallet (proof of authorization)
- `transaction_hash` - Solana transaction hash (exists for both types of vaccinations)
- `created_at, updated_at` - Timestamps

### Vaccination Type Determination

The vaccination type is determined by the `mint_address` field:
- **`mint_address` IS NOT NULL** → Type: `spl_token_mint` (SPL Token Mint)
- **`mint_address` IS NULL** → Type: `vaccine_tx_shot` (Vaccine Tx - Shot)

### Foreign Key Constraint

```sql
FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
```

This ensures:
- Every vaccination links to a valid pet
- If a pet is deleted, its vaccinations are also deleted
- Referential integrity is maintained at the database level

### Indexes

- `idx_pet_id` - Fast lookup of vaccinations by pet
- `idx_vet` - Fast lookup of vaccinations by veterinary clinic
- `idx_vax_mint` - Fast lookup by vaccination token mint (SPL Token Mints)
- `idx_tx_sig` - Fast lookup by transaction signature (authorization proof)
- `idx_tx_hash` - Fast lookup by transaction hash (on-chain verification)

## Transaction Flows

### SPL Token Mint Flow (Initial Vaccination)

When a user records an initial vaccination, an SPL token mint is created:

**Step 1: Record Vaccination (Frontend)**
```
POST /api/v1/petvax/record-with-spl
```
- User signs message: "Record vaccination for pet {petId}: {vaccineName} on {date}"
- Frontend sends vaccination details with signed message

**Step 2: Create Token Mint (Backend)**
- Backend verifies message signature
- Creates SPL token mint for the vaccination
- Mints 1 token to the pet owner's associated token account
- Stores `mint_address` in database

**Step 3: Record to Database**
- Vaccination stored with:
  - `mint_address`: The created SPL token mint
  - `transaction_hash`: Token minting transaction signature
  - `notes`: User-provided notes (optional text)
- Type is `spl_token_mint` (determined by non-null `mint_address`)

### Vaccine Tx (Shot) Flow (Renewal Vaccination)

When a user records a renewal shot, a memo transaction is created:

**Step 1: Prepare Transaction (Backend)**
```
POST /api/v1/petvax/prepare
```
- Backend creates Solana transaction with memo instruction
- Memo includes complete vaccination data + renewal schedule
- Transaction serialized to base64 and returned to frontend

**Step 2: Sign & Send Transaction (Frontend + Phantom)**
- User signs message for pet identity: "Hello, I am the pet named {petName}, this is my noseprint!"
- Pet signature included in memo data
- Phantom signs the transaction
- Frontend submits signed transaction to Solana devnet
- Transaction hash (signature) is returned

**Step 3: Record Vaccination (Backend)**
```
POST /api/v1/petvax/record
```
- Frontend sends vaccination details with:
  - `transactionSignature`: Phantom's wallet proof
  - `transactionHash`: Memo program transaction signature
  - `notes`: Complete JSON memo structure (created in frontend)
- Backend stores both for verification

**Step 4: Database Record**
- Vaccination stored with:
  - `mint_address`: NULL (distinguishes from SPL Token Mint)
  - `transaction_hash`: The memo transaction signature
  - `notes`: JSON memo containing:
    - Pet signature (non-repudiation)
    - Renewal period and schedule
    - Original vaccination token reference
    - URLs (vaccine info, clinic info)
    - Recorded timestamp
- Type is `vaccine_tx_shot` (determined by null `mint_address`)

## API Endpoints

### Record Vaccination with SPL Token Mint (Initial Vaccination)
```
POST /api/v1/petvax/record-with-spl
Body: {
  "petId": "pet_1621234567890",
  "vaccineName": "Rabies",
  "vaccinationDate": "2026-05-24",
  "vetAddress": "VetClinicSolanaAddress...",
  "ownerAddress": "owner_wallet_address",
  "signedMessage": "hex_encoded_signed_message",
  "notes": "Optional notes about the vaccination"
}
```

Returns:
```json
{
  "success": true,
  "onChain": {
    "mint": "token_mint_address",
    "tokenAccount": "associated_token_account",
    "transactionSignature": "tx_signature"
  },
  "vaccination": {
    "id": "vax_1621234567890",
    "pet_id": "pet_1621234567890",
    "vaccine_name": "Rabies",
    "mint_address": "token_mint_address",
    "transaction_hash": "transaction_signature"
  },
  "metadata": {
    "petId": "pet_1621234567890",
    "petName": "Max",
    "transactionHash": "transaction_signature",
    "solscanUrl": "https://solscan.io/tx/...?cluster=devnet"
  }
}
```

### Prepare Vaccine Tx (Renewal Shot) Transaction
```
POST /api/v1/petvax/prepare
Body: {
  "petId": "pet_1621234567890",
  "vaccineName": "Rabies",
  "vaccinationDate": "2026-05-24",
  "vetAddress": "VetClinicSolanaAddress...",
  "mustRenew": true,
  "renewalPeriod": "yearly",
  "customRenewalPeriod": null,
  "vaccinationToken": "original_mint_address",
  "vaccineUrl": "https://...",
  "clinicUrl": "https://..."
}
```

Returns:
```json
{
  "ready": true,
  "transaction": "base64_encoded_transaction",
  "petId": "pet_1621234567890",
  "vaccineName": "Rabies"
}
```

### Record Vaccine Tx (Renewal Shot)
```
POST /api/v1/petvax/record
Body: {
  "petId": "pet_1621234567890",
  "vaccineName": "Rabies",
  "vaccinationDate": "2026-05-24",
  "vetAddress": "VetClinicSolanaAddress...",
  "notes": "{JSON memo structure}",
  "mustRenew": true,
  "renewalPeriod": "yearly",
  "customRenewalPeriod": null,
  "vaccinationToken": "original_mint_address",
  "vaccineUrl": "https://...",
  "clinicUrl": "https://...",
  "petSignature": "hex_encoded_pet_signature",
  "transactionSignature": "tx_signature",
  "transactionHash": "tx_signature"
}
```

Returns:
```json
{
  "success": true,
  "vaccination": {
    "id": "vax_1621234567891",
    "pet_id": "pet_1621234567890",
    "vaccine_name": "Rabies",
    "mint_address": null,
    "transaction_hash": "tx_signature",
    "notes": "{JSON memo structure}"
  },
  "message": "Vaccination recorded on-chain"
}
```

### Get Transaction by Hash (Verification)
```
GET /api/v1/petvax/tx?hash=<transactionHash>
```

Returns vaccination record with direct link to Solscan for verification.

### List Vaccinations for a Pet
```
GET /api/v1/petvax/verify?petId=<petId>
```

Returns:
```json
{
  "pet": { "id", "name", "species", "owner" },
  "vaccinations": [ { all vaccination records with types and transaction data } ],
  "vaccinationCount": 3,
  "onChainProofs": 2,
  "splTokenMints": 1,
  "memoTransactions": 2
}
```

### Get Vaccinations for a Pet
```
GET /api/v1/petvax/pet?petId=<petId>
```

Returns:
```json
{
  "pet": { pet details },
  "vaccinations": [ { vaccination records with type indicators } ]
}
```

### Get Vaccinations by Veterinary Clinic
```
GET /api/v1/petvax/vet?vetAddress=<address>
```

Returns:
```json
{
  "vetAddress": "...",
  "vaccinationCount": 5,
  "vaccinations": [ { vaccination records } ]
}
```

## Running Tests

```bash
# Run all tests
npm test

# Run only petvax tests
npm test -- petvax.test.js

# Run only pettracker tests
npm test -- pettracker.test.js

# Run with coverage
npm test -- --coverage
```

### Test Coverage

PetVax tests verify:
- ✓ Vaccination creation and retrieval
- ✓ Transaction signature storage and verification
- ✓ Transaction hash storage and lookup
- ✓ Foreign key constraint enforcement
- ✓ Pet-to-vaccination linkage
- ✓ Vaccination queries by pet and veterinary clinic
- ✓ Database schema validation (includes transaction_hash column)
- ✓ Index creation (includes idx_tx_sig and idx_tx_hash)
- ✓ Default mandate authority behavior
- ✓ Isolated test database usage
- ✓ Transaction.signature and transaction_hash both stored together

## Troubleshooting

### Transaction fails to submit
- Make sure your wallet has devnet SOL (0.005+ SOL minimum)
- Fund at: https://faucet.solana.com
- Check that vet address is a valid Solana address
- Ensure Phantom is set to devnet (not mainnet)

### Transaction times out waiting for confirmation
- Solana devnet can be unstable
- Try again in a few minutes
- Check Solscan to see if transaction was included in a block

### Phantom won't connect
Make sure you're accessing the site via HTTPS (use ngrok for development).

### Vaccination shows "Signed" but not "On-Chain Verified"
- Transaction may still be pending confirmation
- Wait a few seconds and refresh the page
- Check transaction hash on Solscan manually

### SPL Token Mint not created
- Make sure the backend payer wallet has SOL to cover transaction fees
- Check server logs for "record-with-spl" endpoint errors
- Verify the token mint was created by checking `mint_address` in database

### "New Shot" button doesn't appear
- "New Shot" button only appears on SPL Token Mint type vaccinations (with ✙ icon)
- It will not appear on Vaccine Tx (Shot) type vaccinations (with 💉 icon)
- Make sure the first vaccination for that vaccine was an SPL Token Mint

### Memo data not showing in details modal
- Memo data is only populated for Vaccine Tx (Shot) type vaccinations
- For SPL Token Mint vaccinations, `notes` contains optional user notes (plain text)
- Check the `notes` field in database for the vaccination record

### Vaccination type shows as unknown
- Ensure `mint_address` field in database is properly set/null
- SPL Token Mint: `mint_address` should have a token mint address
- Vaccine Tx (Shot): `mint_address` should be NULL
- Clear browser cache and refresh if display is incorrect

### "Pet not found" when recording vaccination
The pet ID is invalid or the pet hasn't been registered in PetTracker yet.
Solution: Create the pet in PetTracker first, then record vaccinations.

### Vaccination is not showing up
Make sure you're viewing the correct pet. Check the pet selection dropdown.

### Foreign key constraint error
This means the database was created before the vaccinations table existed.
Solution: Delete `pettracker.db` and the app will recreate it with the new schema.

## Production Considerations

For production deployment:

1. **Database Encryption**
   - Encrypt vaccination records at rest
   - Use SQLite encryption extensions

2. **Access Control**
   - Implement authentication for API endpoints
   - Add authorization checks for vet credentials
   - Implement role-based access control

3. **On-Chain Integration**
   - Issue mandate tokens for each vaccination on Solana
   - Link token mints to vaccination records
   - Enable cross-chain verification

4. **Audit Trail**
   - Log all vaccination modifications
   - Store immutable proof on blockchain
   - Implement compliance reporting

5. **Data Privacy**
   - Implement GDPR compliance for pet owner data
   - Support vaccination record anonymization
   - Allow PII retention policies

6. **Network**
   - Use mainnet instead of devnet
   - Implement proper error handling and monitoring
   - Add redundancy for database and API

## Integration with Other Concepts

### PetTracker
PetVax depends on PetTracker:
- Every vaccination record references a PetTracker pet
- Pet details shown in vaccination UI
- Pet deletion cascades to vaccination deletion

### Future: PetDiet
Vaccination records can inform dietary restrictions

### Future: HealthCred
Veterinarian credentials can be verified using HealthCred badges

### Future: CareCircle
Vaccination access can be delegated to caregivers
