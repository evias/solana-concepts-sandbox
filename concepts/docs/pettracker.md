# PetTracker - Solana Pet Registry

A hybrid application that stores pet metadata in a local SQLite database and creates SPL tokens on Solana devnet for each registered pet.

## Architecture

- **Frontend**: Alpine.js + Tailwind CSS with Phantom wallet integration
- **Backend**: Express.js + SQLite + @solana/spl-token
- **Blockchain**: Solana devnet

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Fund Your Payer Wallet

When you first start the server, a backend payer wallet will be created. You need to fund it with SOL on devnet:

1. The server will print the payer address on startup
2. Go to https://faucet.solana.com
3. Paste the payer address and request devnet SOL
4. You need at least 0.01 SOL for a few transactions

Example output:
```
Created new payer keypair: 9YourPayerAddressHere123...
IMPORTANT: Fund this address with SOL
   Address: 9YourPayerAddressHere123...
   On devnet, use: https://faucet.solana.com
```

### 3. Set Up HTTPS (for Wallet Connections)

Phantom and other Solana wallets require HTTPS. Use ngrok for development:

```bash
# In one terminal, start the server
npm start

# In another terminal, expose via ngrok
ngrok http 3000
```

Visit the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`) in your browser.

### 4. Connect Your Wallet

1. Click "Connect Wallet" in the app
2. Select Phantom (or your installed wallet)
3. Approve the connection in your wallet extension

### 5. Register a Pet

1. Fill in the pet details (name, species, breed, age)
2. Click "Register Pet"
3. The app will:
   - Create an SPL token mint on Solana devnet
   - Create an associated token account
   - Mint 1 token representing your pet
   - Store metadata in SQLite

## Project Structure

```
├── api/
│   ├── pettracker.js          # Express API routes
│   ├── database.js            # SQLite database layer
│   ├── solana-tokens.js       # Solana token operations
│   └── payer.js               # Backend payer keypair management
├── concepts/
│   ├── pettracker.html        # Frontend (Alpine.js)
│   └── docs/
│       └── pettracker.md      # This documentation
├── __tests__/
│   ├── pettracker.test.js     # API tests
│   └── solana-tokens.test.js  # Token operations tests
├── pettracker.db              # SQLite database (created on first run)
└── .payer-keypair.json        # Backend wallet (created on first run, gitignored)
```

## Database Schema

The `pets` table stores:
- `id` - Unique pet identifier
- `name, species, breed, age` - Pet metadata
- `owner` - Owner's Solana address
- `mint_address` - On-chain SPL token mint
- `token_account` - Associated token account address
- `created_at, updated_at` - Timestamps

## API Endpoints

### List All Pets
```
GET /api/v1/pettracker/list
```

### Get Pet by ID
```
GET /api/v1/pettracker/get?id=<petId>
```

### Register Pet (Creates On-Chain Token)
```
POST /api/v1/pettracker/register
Body: { petData, ownerAddress }
```

### Edit Pet
```
POST /api/v1/pettracker/edit
Body: { petData, ownerAddress }
```

### Delete Pet
```
POST /api/v1/pettracker/delete
Body: { id, ownerAddress }
```

### Get Token Info
```
GET /api/v1/pettracker/token-info?mint=<mintAddress>
```

## Running Tests

```bash
# Run all tests
npm test

# Run pettracker API tests
npm test -- pettracker.test.js

# Run Solana token tests
npm test -- solana-tokens.test.js
```

## Troubleshooting

### "Attempt to debit an account but found no record of a prior credit"
The payer wallet needs SOL. Fund it at https://faucet.solana.com

### "Insufficient payer balance"
Same as above - the payer has less than 0.005 SOL

### Phantom won't connect
Make sure you're accessing the site via HTTPS (use ngrok for development)

### Wallet balance not updating
Check Solana devnet status at https://status.solana.com

## Production Considerations

For production, you would:
1. Use a proper backend wallet stored securely (e.g., AWS Secrets Manager)
2. Store the database encryption key securely
3. Add authentication for API endpoints
4. Implement proper transaction monitoring
5. Use mainnet instead of devnet
6. Add proper error handling and logging
