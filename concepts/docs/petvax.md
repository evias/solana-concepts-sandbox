# PetVax - Proof of Immunization

Record and verify vaccination records for registered pets. Vaccinations are cryptographically linked to pets on Solana blockchain using two verification methods: SPL Token Mints for initial vaccinations and signed transactions with memo data for renewal shots.

## Getting Started

### 1. Fund Your Wallet

You need SOL on Solana devnet to record vaccinations (approximately 0.005 SOL per vaccination).

1. Note the payer address displayed on server startup
2. Go to https://faucet.solana.com
3. Paste the address and request devnet SOL

### 2. Connect Your Wallet

1. Click "Connect Wallet"
2. Select Phantom wallet
3. Approve the connection

### 3. Select a Pet

1. Click "Select a Pet" dropdown
2. Choose a pet from your PetTracker registry
3. The selected pet's details appear below

## Recording Vaccinations

### Initial Vaccination (SPL Token Mint)

1. Fill in vaccination details:
   - **Vaccine Name** (required): Type of vaccine (e.g., Rabies, DPPE)
   - **Vaccination Date** (required): Date of vaccination
   - **Veterinary Clinic Address** (required): Solana wallet address of vet
   - **Notes** (optional): Additional information
2. Click "Record Vaccination with On-Chain Proof"
3. Approve message signature in Phantom
4. Transaction is submitted to Solana devnet
5. Vaccination is saved with:
   - **Type**: SPL Token Mint (✙ icon)
   - **Status**: 🔐 On-Chain (purple badge)
   - Unique on-chain SPL token created
   - Token mint address for verification

### Renewal Shot (Vaccine Tx)

1. In vaccination history, find the initial vaccination (marked with ✙ icon)
2. Click "📋 New Shot" button
3. Enter renewal details:
   - **Must Renew** (optional): Checkbox to mark recurring vaccination
   - **Renewal Period** (optional): Frequency (monthly, quarterly, yearly, custom)
   - **Vaccine URL** (optional): Link to vaccine information
   - **Clinic URL** (optional): Link to clinic information
4. Click "Record Shot"
5. Sign pet identity message: "Hello, I am the pet named {petName}, this is my noseprint!"
6. Approve transaction in Phantom
7. Renewal shot is recorded with:
   - **Type**: Vaccine Tx (Shot) (💉 icon)
   - **Status**: ✓ Signed (blue badge)
   - Complete vaccination data and renewal schedule stored on-chain
   - Full vaccination information encoded in transaction memo

## Viewing Vaccination History

### Vaccination Table

Search and filter vaccinations by:
- Vaccine name
- Veterinary clinic address
- Vaccination date
- Notes or memo data
- Transaction signature or hash

### Vaccination Types

| Type | Icon | Status | Purpose | Proof |
|------|------|--------|---------|-------|
| SPL Token Mint | ✙ | 🔐 On-Chain | Initial vaccination with on-chain token proof | Token Mint Address |
| Vaccine Tx (Shot) | 💉 | ✓ Signed | Renewal shot with signature and memo data | Transaction Hash |

### Vaccination Details

Click "📋 View Details" on any vaccination to see:
- **Type**: SPL Token Mint or Vaccine Tx (Shot)
- **Vaccine Information**: Name, date, veterinary clinic
- **Token Mint Address**: (SPL Token Mint type only) - the unique token representing this vaccination
- **Transaction Hash**: The blockchain transaction signature
- **Memo Data**: Complete vaccination information in JSON format (Vaccine Tx type only) including renewal details
- **Record Created**: Timestamp
- **Solscan Link**: View transaction on blockchain explorer

## Vaccination Features

### Authorization Model
- **Pet Owner**: Can record vaccinations and see all vaccination history
- **Authorized Veterinarian**: Added via PetTracker authorization, can record vaccinations for authorized pets
- **Access Control**: Only pet owner or authorized vet (via SAS Credential) can record vaccinations

### Search & Filter
- Real-time search by vaccine name, vet address, date, or notes
- Clear button to reset search
- Refresh button to reload vaccination history

### Pagination
- Load more vaccinations as needed
- Collapse to show fewer vaccinations

### Blockchain Verification
- View any vaccination on Solscan blockchain explorer
- Verify on-chain proof of vaccination
- Access memo data for renewal vaccinations
- Verify token mint addresses for initial vaccinations

### Two-Step Vaccination Recording
- **Initial Vaccination**: Uses SPL Token Mint as proof (one-time proof of vaccination)
- **Renewal Shots**: Uses signed memo transactions (supports recurring vaccinations with schedule)

## Troubleshooting

### Cannot record vaccination - insufficient funds
Fund your wallet at https://faucet.solana.com with at least 0.005 SOL

### Phantom won't connect
Make sure you're using an HTTPS connection (required by Phantom)

### "New Shot" button doesn't appear
The "New Shot" button only appears on SPL Token Mint type vaccinations (marked with ✙ icon). Other vaccination types cannot have renewal shots recorded from them.

### Memo data not showing in details modal
Memo data is only displayed for Vaccine Tx (Shot) type vaccinations. SPL Token Mint vaccinations show plain text notes if any were entered.

### Cannot find vaccination
1. Verify you have selected the correct pet
2. Use the search box to filter vaccinations
3. Click "Refresh" to reload the vaccination history

### Transaction fails
Ensure your wallet has sufficient SOL balance and you're connected to Solana devnet (not mainnet)
