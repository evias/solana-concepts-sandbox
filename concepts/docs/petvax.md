# PetVax - Proof of Immunization

A system to record and verify vaccination records for pets registered in PetTracker. Each vaccination is cryptographically linked to exactly one pet and can be issued by authorized veterinary clinics. All vaccinations are recorded on the Solana blockchain for immutable verification.

## Architecture

- **Frontend**: Alpine.js + Tailwind CSS with Phantom wallet integration
- **Backend**: Express.js + SQLite with foreign key constraints  
- **Blockchain**: Solana devnet with full transaction submission
- **Integration**: Linked to PetTracker pet registry via foreign keys
- **On-Chain**: Vaccination memo data stored in Solana transactions

## Key Features

### 1. Full On-Chain Integration
- Vaccinations are recorded as full Solana transactions (not just signed messages)
- Transaction hash stored for Solscan verification
- Cryptographic proof of vaccination on immutable blockchain
- Direct link to view transaction on Solscan block explorer

### 2. Transaction Flow
- **Prepare**: Backend creates vaccination transaction with memo instruction
- **Sign**: Phantom wallet user signs the transaction
- **Submit**: Frontend submits signed transaction to Solana devnet
- **Confirm**: Frontend waits for blockchain confirmation
- **Record**: Vaccination metadata stored with transaction hash and signature
- **Verify**: Users can view vaccination on Solscan via transaction hash

### 3. Foreign Key Integrity
- Every vaccination record is linked to exactly one pet from PetTracker
- Database enforces referential integrity with `ON DELETE CASCADE`
- Cannot create vaccination for non-existent pets

### 4. Veterinary Authorization
- Veterinary clinics use Solana wallet addresses to identify themselves
- Vet address stored with each vaccination record for accountability
- Mandate-based system allows future authorization contracts

### 5. Pet Selection
- Users can only record vaccinations for registered pets
- Pet list fetched from PetTracker registry
- Visual confirmation of selected pet details

### 6. Vaccination Verification
- Pet owners and third parties can verify vaccination history
- Complete vaccination timeline for each pet
- Direct link to on-chain proof via Solscan

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

### 5. Record a Vaccination (Full On-Chain Flow)

1. Connect your wallet (Phantom)
2. Select a pet from the PetTracker registry
3. Enter vaccination details:
   - Vaccine name (e.g., Rabies, DPPE, Lepto)
   - Vaccination date
   - Veterinary clinic Solana address
   - Optional notes
4. Click "Record Vaccination with On-Chain Proof"
5. Follow the steps:
   - **Sign**: Phantom opens for transaction signing
   - **Submit**: Transaction is submitted to Solana devnet
   - **Confirm**: Frontend waits for blockchain confirmation
   - **Record**: Vaccination is saved with transaction hash and signature

### 6. Verify Vaccinations

1. Select a pet to view its vaccination history
2. See all recorded vaccinations with dates and veterinary clinic info
3. **On-Chain Verified** (purple badge) - vaccination has transaction hash on blockchain
4. **Signed** (blue badge) - vaccination has digital signature but no transaction hash
5. **Verified** (green badge) - vaccination record confirmed
6. Click "View on Solscan" to see the transaction on the blockchain explorer

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
- `notes` - Optional vaccination notes
- `mint_address` - (Future) SPL token mint for this vaccination
- `transaction_signature` - Digital signature from Phantom wallet (proof of authorization)
- `transaction_hash` - Solana transaction hash (on-chain proof of vaccination)
- `created_at, updated_at` - Timestamps

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
- `idx_vax_mint` - Fast lookup by vaccination token mint
- `idx_tx_sig` - Fast lookup by transaction signature (authorization proof)
- `idx_tx_hash` - Fast lookup by transaction hash (on-chain verification)

## Transaction Signing Flow

When a user records a vaccination, the following on-chain flow occurs:

### Step 1: Prepare Transaction (Backend)
```
POST /api/v1/petvax/prepare
```
- Backend creates a Solana transaction with vaccination memo data
- Transaction is serialized and returned to frontend as base64

### Step 2: Sign Transaction (Frontend + Phantom)
- Frontend deserializes the transaction
- Requests Phantom wallet to sign the transaction
- Phantom opens for user approval
- Signed transaction is returned

### Step 3: Submit Transaction (Frontend)
- Frontend submits signed transaction to Solana devnet
- Solana network processes and includes transaction in next block
- Transaction hash (signature) is returned

### Step 4: Wait for Confirmation (Frontend)
- Frontend polls for transaction confirmation
- Waits for block finality on devnet
- Once confirmed, transaction is immutable

### Step 5: Record Vaccination (Backend)
```
POST /api/v1/petvax/record
```
- Frontend sends vaccination details with:
  - `transactionSignature` - Phantom's wallet proof
  - `transactionHash` - Solana's on-chain transaction ID
- Backend stores both for verification

## API Endpoints

### Prepare Vaccination Transaction (On-Chain)
```
POST /api/v1/petvax/prepare
Body: {
  "petId": "pet_1621234567890",
  "vaccineName": "Rabies",
  "vaccinationDate": "2026-05-19",
  "vetAddress": "VetClinicSolanaAddress..."
}
```

Returns:
```json
{
  "ready": true,
  "transaction": "base64_encoded_transaction",
  "petId": "pet_1621234567890",
  "vaccineName": "Rabies",
  "vetAddress": "VetClinicSolanaAddress..."
}
```

### Record a Vaccination with On-Chain Proof
```
POST /api/v1/petvax/record
Body: {
  "petId": "pet_1621234567890",
  "vaccineName": "Rabies",
  "vaccinationDate": "2026-05-19",
  "vetAddress": "VetClinicSolanaAddress...",
  "notes": "Annual booster",
  "transactionSignature": "sig...base64...",
  "transactionHash": "5sGjZRX9yHeYqvdC8L..."
}
```

Returns:
```json
{
  "success": true,
  "vaccination": { vaccination record with both signatures },
  "message": "Vaccination recorded on-chain",
  "metadata": {
    "petId": "pet_1621234567890",
    "petName": "Buddy",
    "transactionHash": "5sGjZRX9yHeYqvdC8L...",
    "solscanUrl": "https://solscan.io/tx/5sGjZRX9yHeYqvdC8L...?cluster=devnet"
  }
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
  "vaccinations": [ { all vaccination records with transaction hashes } ],
  "vaccinationCount": 3,
  "onChainProofs": 2
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
  "vaccinations": [ { vaccination records } ]
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
