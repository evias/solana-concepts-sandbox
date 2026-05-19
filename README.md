# dHealth Solana Concepts Sandbox

A comprehensive sandbox for exploring Solana concepts, building with SPL tokens, and testing dapp integration patterns. Includes a fully functional **PetTracker** application that demonstrates hybrid on-chain/off-chain storage using SPL tokens.

⚠️ CAUTION: EXPERIMENTAL SOFTWARE

This is experimental software not intended for production use. 
Use at your own risk. See LICENSE for the complete terms and liability limitations.

## Features

- **PetTracker Application** - Register pets as SPL tokens on Solana devnet
- **Wallet Integration** - Phantom wallet connect with Alpine.js frontend
- **Hybrid Architecture** - SQLite database + Solana blockchain
- **Unit Tests** - Comprehensive Jest test suites for API and token operations
- **Devnet Ready** - Works out-of-the-box with Solana devnet

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Phantom wallet (or any Solana wallet supporting devnet)
- ngrok (for local HTTPS testing)

### Installation

```bash
# Clone and install
git clone <repo>
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
IMPORTANT: Fund this address with SOL
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
│   ├── pettracker.js          # Express routes
│   ├── database.js            # SQLite CRUD operations
│   ├── solana-tokens.js       # SPL token operations
│   └── payer.js               # Backend wallet management
├── concepts/
│   ├── pettracker.html        # Frontend (Alpine.js + Tailwind)
│   └── index.html             # Main page
├── __tests__/
│   ├── pettracker.test.js     # API tests (18 tests)
│   └── solana-tokens.test.js  # Token tests (27 tests)
├── ARCHITECTURE.md            # Architecture details
├── PETTRACKER_README.md       # PetTracker app documentation
└── server.js                  # Express server entry point
```

## Available Commands

```bash
npm start              # Start development server on port 3000
npm test               # Run all tests
npm test -- pettracker.test.js        # Run API tests
npm test -- solana-tokens.test.js     # Run token operation tests
npm run build          # Build Tailwind CSS
npm run watch          # Watch and rebuild Tailwind CSS
```

## Developer Notes

### Database
- **SQLite** database stored in `pettracker.db`
- Schema includes: `pets` table with owner, mint address, and token account references
- CRUD operations in `api/database.js`

### Solana Integration
- Connects to **devnet**: `https://api.devnet.solana.com`
- Each pet gets a unique SPL token mint (0 decimals)
- Owner receives 1 token in their associated token account
- All transactions paid by backend payer wallet

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
- 45+ tests total covering API and token operations
- `npm test` to run all, or target specific test files
- Tests don't require blockchain connection

### Common Issues

| Issue | Solution |
|-------|----------|
| "Insufficient payer balance" | Fund payer at https://faucet.solana.com |
| Phantom won't connect | Ensure you're using HTTPS (via ngrok) |
| Database locked | Delete `pettracker.db` and restart |

## Architecture Highlights

- **Express.js** backend with RESTful API
- **SQLite** for persistent metadata storage
- **@solana/spl-token** for SPL token operations
- **@solana/web3.js** for blockchain interactions
- Secure wallet key storage with filesystem encryption
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


