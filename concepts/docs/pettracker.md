# PetTracker - Solana Pet Registry

Register pets and create on-chain proof of pet ownership using Solana blockchain. Each pet registration creates a unique SPL token on Solana devnet.

## Getting Started

### 1. Fund Your Wallet

You need SOL on Solana devnet to create pet tokens (approximately 0.005 SOL per pet).

1. Note the payer address displayed on server startup
2. Go to https://faucet.solana.com
3. Paste the address and request devnet SOL

### 2. Connect Your Wallet

1. Click "Connect Wallet"
2. Select Phantom wallet
3. Approve the connection

### 3. Register a Pet

1. Enter pet details:
   - **Pet Name** (required): The name of your pet
   - **Species** (required): Type of animal (e.g., Dog, Cat, Rabbit)
   - **Breed** (optional): Specific breed
   - **Age** (optional): Age in years
2. Click "Register Pet"
3. Approve the transaction in Phantom
4. Your pet is now registered with an on-chain SPL token

## Features

### Pet Listing
- View all registered pets in a searchable list
- Search by name, species, breed, or owner address
- Filter results in real-time
- Load more pets using pagination

### Pet Management
- **Edit Pet**: Update pet name, species, breed, or age
- **Delete Pet**: Remove pet from registry
- **View Details**: See full pet information and on-chain token address

### On-Chain Proof
- Each pet gets a unique SPL token mint address
- Token serves as immutable proof of pet registration
- View token details and owner information
- Verify pet ownership through blockchain

## Troubleshooting

### Cannot register pet - insufficient funds
Fund your wallet at https://faucet.solana.com with at least 0.005 SOL

### Phantom won't connect
Make sure you're using an HTTPS connection (required by Phantom)

### Pet details won't update
Ensure you're connected to your wallet and have SOL in your account

### Cannot delete pet
You must be the pet owner to delete it. Verify your wallet connection matches the owner address
