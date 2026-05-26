# PetDiet - Nutrition Plans & Feeding Logs

## Overview

PetDiet is a decentralized nutrition management system for pets, integrated with PetTracker. It enables pet owners to create customized nutrition plans and log daily feeding actions on-chain using Solana blockchain technology.

Each nutrition plan is backed by an SPL token mint, and feeding actions are recorded as on-chain transactions with cryptographically verified signatures.

## Features

### 1. Nutrition Plan Management

#### Create a Nutrition Plan

Pet owners can create custom nutrition plans with the following details:

- **Plan Name**: A descriptive name for the nutrition plan (e.g., "Summer Wellness Plan")
- **Start Date**: When the nutrition plan begins
- **Ingredients Per Day**: Specify ingredients for each day of the week:
  - Monday through Sunday (7 text fields)
  - If a day is left empty, it will automatically inherit the ingredients from the last filled day
  - At least one day must have ingredients specified
- **Duration**: Select from pre-defined durations:
  - 2 weeks
  - 1 month
  - 2 months
  - 3 months
  - 6 months
  - 1 year
- **Authorized Nutritioner** (Optional): A Solana account address with permission to record feeding actions for this pet

#### Blockchain Integration

When a nutrition plan is created:

1. An SPL Token Mint is generated on Solana devnet
2. A token is minted to represent the nutrition plan
3. The plan metadata is stored on-chain
4. A record is maintained in the local database with:
   - Plan details
   - Mint address (SPL Token)
   - Transaction hash for Solscan verification

### 2. Feeding Action Logging

#### Record a Feeding Event

Pet owners (or authorized nutritioners) can log daily feeding actions:

1. **Select a Pet**: Choose from your registered pets
2. **Select a Nutrition Plan**: Choose which plan the feeding falls under
3. **Enter Ingredients Given**: The actual ingredients fed to the pet today
   - Pre-filled with today's ingredients from the nutrition plan
   - Can be modified if actual feeding differed from the plan
4. **Sign with Wallet**: The app requires a message signature proving ownership
   - Message format: "Hello, I am the pet named {PetName}, this is my noseprint!"
   - This cryptographic signature is stored with the feeding record
5. **Confirm Transaction**: Sign the transaction to record the feeding on-chain

#### Transaction Details

Each feeding action recorded includes:

- **Pet Signature**: Cryptographic proof from message signing
- **Ingredients**: What was actually fed to the pet
- **Timestamp**: When the feeding was recorded
- **Transaction Hash**: Solscan link for verification

### 3. Feeding History

View all feeding actions for a nutrition plan:

- Lists all recorded feeding events chronologically
- Shows ingredients, timestamp, and signatures
- Provides Solscan links for on-chain verification
- Helps track nutritional compliance over time

## How to Use

### Getting Started

1. **Connect Your Wallet**
   - Click "Connect Wallet" button
   - Use Phantom wallet for HTTPS connections
   - Or manually enter your Solana account address

2. **Select a Pet**
   - Choose a registered pet from the dropdown
   - You can select pets you own or pets where you're an authorized veterinarian

### Creating a Nutrition Plan

1. Fill in the plan details (name, start date, duration)
2. Specify ingredients for each day of the week
   - Provide at least one day's ingredients
   - Empty days will auto-fill from the last filled day
3. Optionally specify an authorized nutritioner address
4. Click "Create Nutrition Plan"
5. Approve the wallet signature request
6. Wait for transaction confirmation on devnet
7. View your SPL Token and Solscan link in the success message

### Logging Feeding Actions

1. Select a nutrition plan from the list
2. Click "Feed Now" button
3. Review the pre-filled ingredients for today
4. Modify ingredients if needed
5. Click "Sign & Submit Feeding"
6. Approve the message signature (proves pet ownership/authorization)
7. Approve the transaction
8. Wait for confirmation and view the Solscan link

### Viewing Feeding History

1. Select a nutrition plan
2. Click "View Feeding History"
3. Browse all recorded feeding events
4. Click Solscan links to verify on-chain

## Blockchain Details

### Solana Network

- **Network**: Solana devnet (development/testing)
- **Memo Program**: `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
- **SPL Token Program**: Used for nutrition plan mints

### On-Chain Data

**Nutrition Plans** contain:
- `type`: "nutrition_plan"
- `planId`: Unique identifier
- `petId`: Associated pet
- `planName`: Display name
- `ingredients`: All weekly ingredients
- `duration`: Plan duration (2 weeks to 1 year)
- `authorizedNutritioner`: Optional nutritioner address

**Feeding Actions** contain:
- `type`: "feeding_action"
- `nutritionPlanId`: Linked plan
- `petId`: Pet being fed
- `ingredients`: Actfully fed to the pet
- `petSignature`: Cryptographic proof
- `timestamp`: When feeding was recorded

### Verification

All on-chain activities can be verified on **Solscan**:

- Paste transaction hashes into: https://solscan.io/?cluster=devnet
- Verify SPL token mints for nutrition plans
- Review memo data for plan and feeding details
- Confirm signatures and timestamps

## Data Storage

### Local Database (SQLite)

Stores metadata for faster display:
- Nutrition plan summaries
- Feeding action records
- Pet ownership relationships
- Authorization mappings

### On-Chain (Solana Devnet)

Stores immutable records via:
- SPL Token Mint (nutrition plan representation)
- Memo Program Transactions (detailed data)

## Authorization & Permissions

- **Pet Owner**: Can create plans, log feedings, manage authorizations
- **Authorized Nutritioner**: Can log feeding actions for assigned pets
- **Both**: Can view nutrition plans and feeding history

## Troubleshooting

### Connection Issues

**Problem**: "Phantom wallet not found"
- **Solution**: Install Phantom from phantom.app
- **Alternative**: Use manual address entry

### Transaction Failures

**Problem**: Transaction rejected or timeout
- **Solution**: Ensure sufficient SOL balance in devnet wallet
- **Get Devnet SOL**: Use Solana CLI `solana airdrop 2` or web faucet

### Missing Pets

**Problem**: Pet not appearing in dropdown
- **Solution**: Register pet in PetTracker first
- **Check**: Ensure you're the owner or an authorized veterinarian

### SPL Token Issues

**Problem**: Token mint showing undefined
- **Solution**: Wait for backend to confirm transaction
- **Check**: Verify Solscan link for on-chain status

## Best Practices

1. **Plan Diversity**: Create multiple plans for different seasons or health goals
2. **Regular Logging**: Log feeding actions daily for accurate health records
3. **Documentation**: Include specific ingredients and quantities for veterinary reference
4. **Backup**: Keep Solscan links for permanent records
5. **Authorization**: Only authorize trusted nutritioners for your pets

## Limitations

- **Devnet Only**: Not for production/real pets (devnet data resets)
- **Solana Address Format**: Must be valid base58-encoded public key
- **Plan Duration**: Pre-defined options (cannot set custom durations)
- **Weekly Granularity**: Ingredients defined per day, not per meal

## Integration with Other Concepts

### PetTracker

- Nutrition plans created for PetTracker-registered pets
- Respects PetTracker authorization mappings
- Uses pet ownership from PetTracker

### PetVax

- Similar on-chain architecture for vaccination records
- Both use SPL Token Mints and Memo program
- Complementary health record systems

## Technical Stack

- **Frontend**: Alpine.js (Alpine.js data binding and reactivity)
- **Backend**: Express.js (API endpoints)
- **Blockchain**: Solana devnet
- **Tokens**: @solana/spl-token library
- **Storage**: SQLite (local) + Solana (immutable)
- **Signatures**: Phantom wallet (message + transaction signing)

## Support

For issues or questions:
- Check Solscan for on-chain verification
- Review browser console for debugging
- Verify Phantom wallet connection
- Ensure devnet wallet has sufficient SOL

---

*PetDiet: On-Chain Nutrition for Your Pets*

**Version**: 1.0.0  
**Network**: Solana Devnet  
**Last Updated**: May 2026
