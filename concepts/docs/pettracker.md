# PetTracker - Solana Pet Registry

Register pets and create on-chain proof of pet ownership using Solana blockchain. Each pet registration creates a unique SPL token on Solana devnet. Authorize veterinarians to manage vaccination records for your pet on the blockchain.

## Getting Started

### 1. Fund Your Wallet

You need SOL on Solana devnet to create pet tokens and authorize veterinarians (approximately 0.01 SOL per pet + authorizations).

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

### 4. Authorize Veterinaries (Required)

After registering a pet, you must authorize at least one veterinarian:

1. Scroll to "Authorize a Veterinary" form
2. Select your pet from the dropdown
3. Enter the veterinary Solana wallet address (required for all pets)
4. Click "Authorize Veterinary"
5. Approve the SAS (Solana Attestation Service) transaction in Phantom
6. Vet is now authorized to record vaccinations for your pet

## Features

### Pet Listing
- View all registered pets in a searchable list
- Search by name, species, breed, or owner address
- Filter results in real-time
- Load more pets using pagination
- See authorized veterinaries for each pet
- "No veterinary authorized" warning (clickable to jump to authorization form)

### Pet Management
- **Edit Pet**: Update pet name, species, breed, or age
- **Delete Pet**: Remove pet from registry
- **View Details**: See full pet information and on-chain token address

### Veterinary Authorization
- Authorize one or more veterinarians per pet
- Each vet gets added to an on-chain SAS Credential
- Vets appear in pet listings with truncated addresses
- Click "No veterinary authorized" to quickly add one
- Multiple vets can be authorized for the same pet

### On-Chain Proof
- Each pet gets a unique SPL token mint address
- Token serves as immutable proof of pet registration
- Authorization stored in Solana Attestation Service Credentials
- View token details and owner information
- Verify pet ownership and vet authorization through blockchain

### Solana Attestation Service Integration
- Each pet owner gets one SAS Credential
- Credential stores all authorized veterinarians for all pets
- Credentials are on-chain PDAs (Program Derived Addresses)
- Credentials updated when new vets are authorized
- Enables verifiable vaccination records via PetVax

## Troubleshooting

### Cannot register pet - insufficient funds
Fund your wallet at https://faucet.solana.com with at least 0.01 SOL

### Phantom won't connect
Make sure you're using an HTTPS connection (required by Phantom)

### Pet details won't update
Ensure you're connected to your wallet and have SOL in your account

### Cannot delete pet
You must be the pet owner to delete it. Verify your wallet connection matches the owner address

### Cannot authorize veterinary
Ensure the vet address is a valid Solana address (32-44 base58 characters). Check that you have enough SOL for the SAS transaction (~0.005 SOL)

### "No veterinary authorized" warning appears
Every pet requires at least one authorized veterinarian. Use the authorization form to add one. The warning is clickable and will scroll to the form.

### Veterinary already authorized error
You cannot authorize the same vet address twice for a pet. This is by design to prevent duplicate entries.

### SAS Credential creation failed
The Solana Attestation Service may be experiencing issues. Check that:
1. You're using devnet (not mainnet)
2. Your wallet has sufficient SOL (~0.01 per transaction)
3. The devnet SAS program is available

### Vet list not showing after authorization
Refresh the page to reload pet data from the backend. The authorization may have succeeded but the UI needs to be updated.

