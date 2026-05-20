# PetVax - Proof of Immunization

A system to record and verify vaccination records for pets registered in PetTracker. Each vaccination is cryptographically linked to exactly one pet and can be issued by authorized veterinary clinics.

## Architecture

- **Frontend**: Alpine.js + Tailwind CSS with Phantom wallet integration
- **Backend**: Express.js + SQLite with foreign key constraints
- **Blockchain**: Solana devnet (for future mandate tokens)
- **Integration**: Linked to PetTracker pet registry via foreign keys

## Key Features

### 1. Foreign Key Integrity
- Every vaccination record is linked to exactly one pet from PetTracker
- Database enforces referential integrity with `ON DELETE CASCADE`
- Cannot create vaccination for non-existent pets

### 2. Veterinary Authorization
- Veterinary clinics use Solana wallet addresses to identify themselves
- Vet address stored with each vaccination record for accountability
- Mandate-based system allows future authorization contracts

### 3. Pet Selection
- Users can only record vaccinations for registered pets
- Pet list fetched from PetTracker registry
- Visual confirmation of selected pet details

### 4. Vaccination Verification
- Pet owners and third parties can verify vaccination history
- Complete vaccination timeline for each pet
- Vaccination details include vaccine type, date, and recording vet

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
# Fund it: https://faucet.solana.com
```

### 3. Set Up HTTPS (for Wallet Connections)

Phantom and other Solana wallets require HTTPS:

```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Expose via ngrok
ngrok http 3000
```

Visit the ngrok HTTPS URL in your browser.

### 4. Connect Your Wallet

1. Click "Connect Wallet" in the app
2. Select Phantom (or your installed wallet)
3. Approve the connection

### 5. Record a Vaccination

1. Connect your wallet
2. Select a pet from the PetTracker registry
3. Enter vaccination details:
   - Vaccine name (e.g., Rabies, DPPE, Lepto)
   - Vaccination date
   - Veterinary clinic Solana address
   - Optional notes
4. Click "Record Vaccination"

### 6. Verify Vaccinations

1. Select a pet to view its vaccination history
2. See all recorded vaccinations with dates and veterinary clinic info
3. Verified vaccinations show a green checkmark

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

## API Endpoints

### List Vaccinations for a Pet
```
GET /api/v1/petvax/verify?petId=<petId>
```

Returns:
```json
{
  "pet": { "id", "name", "species", "owner" },
  "vaccinations": [ { all vaccination records } ],
  "vaccinationCount": 3
}
```

### Record a New Vaccination
```
POST /api/v1/petvax/record
Body: {
  "petId": "pet_1621234567890",
  "vaccineName": "Rabies",
  "vaccinationDate": "2026-05-19",
  "vetAddress": "VetClinicSolanaAddress...",
  "notes": "Annual booster"
}
```

Returns:
```json
{
  "success": true,
  "vaccination": { vaccination record },
  "metadata": {
    "petId": "...",
    "petName": "...",
    "vetAddress": "..."
  }
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
- ✓ Foreign key constraint enforcement
- ✓ Pet-to-vaccination linkage
- ✓ Vaccination queries by pet and veterinary clinic
- ✓ Database schema validation
- ✓ Index creation
- ✓ Default mandate authority behavior
- ✓ Isolated test database usage

## Troubleshooting

### "Pet not found" when recording vaccination
The pet ID is invalid or the pet hasn't been registered in PetTracker yet.
Solution: Create the pet in PetTracker first, then record vaccinations.

### Vaccination is not showing up
Make sure you're viewing the correct pet. Check the pet selection dropdown.

### Foreign key constraint error
This means the database was created before the vaccinations table existed.
Solution: Delete `pettracker.db` and the app will recreate it with the new schema.

### Phantom won't connect
Make sure you're accessing the site via HTTPS (use ngrok for development).

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
