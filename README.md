# dHealth Solana Concepts Sandbox

A comprehensive sandbox for exploring Solana concepts, building with SPL tokens, and testing dapp integration patterns. Includes a fully functional **PetTracker** application that demonstrates hybrid on-chain/off-chain storage using SPL tokens.

⚠️ CAUTION: EXPERIMENTAL SOFTWARE

This is experimental software not intended for production use. 
Use at your own risk. See LICENSE for the complete terms and liability limitations.

## Features

- **Credentials Registry** - Distributed Credentials with Solana Attestation Service (SAS) 
- **Mandates / Delegations** - Uses SAS Credentials to authorize additional signers.
- **Wallet Integration** - Phantom wallet connect with Alpine.js frontend.
- **Token Mints / NFT** - SPL Token Mints and on-demand NFT issuance.
- **Devnet Ready** - Works out-of-the-box with Solana DevNet.
- **Hybrid Architecture** - Solana DevNet blockchain + SQLite database for caching.
- **Unit Tests** - Comprehensive Jest test suites for API and token operations.

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Phantom wallet (or any Solana wallet supporting devnet)
- ngrok (for local HTTPS testing)

### Installation

```bash
# Clone and install
git clone https://github.com/evias/solana-concepts-sandbox
cd solana-concepts-sandbox
npm install
```

### Running the Application

#### 1. Fund Your Backend Wallet
On first run, the server creates a payer keypair:

```bash
npm start
```

The server will output:
```
Created new payer keypair: YOUR_ADDRESS_HERE
IMPORTANT: Fund this address with DevNet SOL
   On devnet, use: https://faucet.solana.com
```

Copy the address and fund it with at least 0.01 SOL on devnet.

#### 2. Start the Server
```bash
npm start
```
Server runs on `http://localhost:3000`

#### 3. Create HTTPS Tunnel (for Wallet Connection)
In a new terminal:
```bash
ngrok http 3000
```

#### 4. Access the App
Visit the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`) in your browser and connect your wallet.

## Project Structure

```
├── api/
│   ├── pettracker.js          # Express routes (per concept API)
│   ├── database.js            # SQLite CRUD operations
│   ├── solana-tokens.js       # SPL token operations
│   └── payer.js               # Backend wallet management
├── concepts/
|   ├── docs/
|       ├── pettracker.md      # Documentation about PetTracker
│   ├── pettracker.html        # Frontend (Alpine.js + Tailwind)
│   └── index.html             # Main page
├── scripts/
│   ├── db-init.js             # Database initialization script (npm run db:init)
│   ├── db-seed.js             # Database seeding script, imports test data (npm run db:seed)
│   ├── db-migrate.js          # Database migration script, see DBHEAD (npm run db:migrate)
├── __tests__/
│   ├── pettracker.test.js     # API tests (18 tests)
│   └── solana-tokens.test.js  # Token tests (27 tests)
├── ARCHITECTURE.md            # Architecture details
├── DBHEAD                     # Latest database migration included in current repository HEAD.
└── server.js                  # Express server entry point
```

## Available Commands

```bash
npm start              # Start development server on port 3000
npm test               # Run all tests
npm run build          # Build Tailwind CSS
npm run watch          # Watch and rebuild Tailwind CSS
```

## Developer Notes

### Database
- **SQLite** database stored in `sandbox.db`, unit tests use `sandbox.test.db`.
- Schema includes: `pets` table with owner, mint address, and token account references
- CRUD operations for pets database in `api/database.js`

### Solana Integrations
- Connects to **devnet**: `https://api.devnet.solana.com`
- Each pet gets a unique SPL token mint (0 decimals)
- Owner receives 1 token in their associated token account
- PetTracker/PetVax/PetDiet transactions paid by backend payer wallet
- HealthCred/CareCircle transactions paid by *connected* wallet (end-user)

### Backend Payer Wallet
- Created automatically on first run: `.payer-keypair.json`
- Must be funded with SOL on devnet to pay transaction fees
- Reused for all on-chain operations
- **Never commit this file to git** (it's in `.gitignore`)

### Frontend
- Built with **Alpine.js** for lightweight interactivity
- **Tailwind CSS** for styling
- **Phantom wallet** integration using standard Solana provider APIs
- Stores connected wallet address in localStorage

### Testing
- **Jest** test framework with mocked Solana libraries
- `npm test` to run all, or target specific test files
- Tests don't require blockchain connection

### Common Issues

| Issue | Solution |
|-------|----------|
| "Insufficient payer balance" | Fund payer at https://faucet.solana.com |
| Phantom won't connect | Ensure you're using HTTPS (via ngrok) |
| Phantom doesn't response | Reload the page and try again |

## Architecture Highlights

- **Express.js** backend with RESTful API (per concept)
- **SQLite** for persistent metadata storage
- **@solana/spl-token** for SPL token operations
- **@solana/web3.js** for blockchain interactions
- Comprehensive error handling with helpful messages

## Production Considerations

For production deployment:
- Move payer key to secure vault (AWS Secrets Manager, etc.)
- Use environment variables for configuration
- Implement API authentication/authorization
- Add rate limiting and request validation
- Use PostgreSQL instead of SQLite for scalability
- Migrate to mainnet (or your target cluster)
- Implement comprehensive logging and monitoring
- Add proper error tracking (Sentry, etc.)

## Resources

- [Solana Documentation](https://docs.solana.com)
- [SPL Token Program](https://github.com/solana-labs/solana-program-library/tree/master/token)
- [Phantom Wallet](https://phantom.app)
- [Alpine.js Documentation](https://alpinejs.dev)
- [Tailwind CSS](https://tailwindcss.com)

## Contributing

Contributions welcome! Please ensure:
- New features include unit tests
- All tests pass: `npm test`
- Code follows existing style conventions
- Commit messages are descriptive and comply with ConventionalCommits

## Support

For issues or questions:
1. Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design details
2. Run tests to verify setup: `npm test`
3. Check server logs for detailed error messages

## License

MIT License - See [LICENSE](LICENSE) file for details

Copyright © 2026 Grégory Saive for re:Software S.L. (greg@evi.as)


