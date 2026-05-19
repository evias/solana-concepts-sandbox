const express = require('express');
const web3 = require('@solana/web3.js');
const { petDb } = require('./database');
const { createPetTokenMint, createAssociatedTokenAccount, mintPetToken, getTokenInfo } = require('./solana-tokens');

const router = express.Router();

// Solana connection
const connection = new web3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

// Function to ensure token account exists (airdrop SOL if needed)
async function ensureTokenAccountExists(ownerPublicKey) {
  try {
    const accountInfo = await connection.getAccountInfo(ownerPublicKey);
    if (!accountInfo) {
      // Create account if it doesn't exist
      const signature = await connection.requestAirdrop(ownerPublicKey, 1000000000); // 1 SOL
      await connection.confirmTransaction(signature);
      console.log('Created account and airdropped SOL:', ownerPublicKey.toBase58());
    }
    return true;
  } catch (error) {
    console.error('Error ensuring token account exists:', error);
    return false;
  }
}

// GET /api/v1/pettracker/list - List all pets (from database)
router.get('/list', async (req, res) => {
  try {
    const pets = petDb.getAllPets();
    res.json(pets);
  } catch (error) {
    console.error('Error listing pets:', error);
    res.status(500).json({ error: 'Failed to list pets' });
  }
});

// GET /api/v1/pettracker/get?id=<petId> - Get pet by ID (from database)
router.get('/get', async (req, res) => {
  try {
    const petId = req.query.id;
    if (!petId) {
      return res.status(400).json({ error: 'Pet ID is required' });
    }
    
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    res.json(pet);
  } catch (error) {
    console.error('Error getting pet:', error);
    res.status(500).json({ error: 'Failed to get pet' });
  }
});

// POST /api/v1/pettracker/edit - Add or update a pet
router.post('/edit', express.json(), async (req, res) => {
  try {
    const { petData, ownerAddress } = req.body;
    
    if (!petData || !petData.id) {
      return res.status(400).json({ error: 'Invalid pet data or missing id' });
    }
    
    if (!ownerAddress) {
      return res.status(400).json({ error: 'Owner address is required' });
    }
    
    // Validate Solana address
    let ownerPublicKey;
    try {
      ownerPublicKey = new web3.PublicKey(ownerAddress);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }
    
    // Ensure the owner's account exists
    await ensureTokenAccountExists(ownerPublicKey);
    
    // Check if pet already exists
    if (petDb.petExists(petData.id)) {
      // Update existing pet
      const updated = petDb.updatePet(petData.id, {
        name: petData.name,
        species: petData.species,
        breed: petData.breed,
        age: petData.age
      });
      
      return res.json({ 
        success: true, 
        pet: updated,
        message: 'Pet updated successfully'
      });
    } else {
      // Create new pet (without on-chain token)
      const newPet = petDb.createPet({
        id: petData.id,
        name: petData.name,
        species: petData.species,
        breed: petData.breed,
        age: petData.age,
        owner: ownerAddress
      });
      
      return res.json({ 
        success: true, 
        pet: newPet,
        message: 'Pet created successfully'
      });
    }
  } catch (error) {
    console.error('Error editing pet:', error);
    res.status(500).json({ error: 'Failed to edit pet' });
  }
});

// POST /api/v1/pettracker/delete - Delete a pet
router.post('/delete', express.json(), async (req, res) => {
  try {
    const { id, ownerAddress } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Pet ID is required' });
    }
    
    if (!ownerAddress) {
      return res.status(400).json({ error: 'Owner address is required' });
    }
    
    // Check if pet exists and belongs to owner
    const pet = petDb.getPetById(id);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Validate Solana address
    try {
      new web3.PublicKey(ownerAddress);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }
    
    if (pet.owner !== ownerAddress) {
      return res.status(403).json({ error: 'Not authorized to delete this pet' });
    }
    
    // Delete from database
    petDb.deletePet(id);
    
    // Note: In a real implementation, you might also burn the token or transfer it
    // For now, we'll just archive it in the database
    
    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting pet:', error);
    res.status(500).json({ error: 'Failed to delete pet' });
  }
});

// POST /api/v1/pettracker/register - Register a new pet with Solana SPL Token
router.post('/register', express.json(), async (req, res) => {
  try {
    const { petData, ownerAddress } = req.body;
    
    if (!petData || !petData.id) {
      return res.status(400).json({ error: 'Invalid pet data or missing id' });
    }
    
    if (!ownerAddress) {
      return res.status(400).json({ error: 'Owner address is required' });
    }
    
    // Validate Solana address
    let ownerPublicKey;
    try {
      ownerPublicKey = new web3.PublicKey(ownerAddress);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }
    
    console.log(`Registering pet ${petData.id} for owner ${ownerAddress}...`);
    
    // Ensure the owner's account exists on-chain
    await ensureTokenAccountExists(ownerPublicKey);
    
    // Create an SPL Token mint for the pet
    console.log('Creating SPL Token mint...');
    const mintResult = await createPetTokenMint(ownerPublicKey);
    const mintAddress = mintResult.mintAddress;
    
    // Create associated token account for the owner
    console.log('Creating associated token account...');
    const tokenAccountResult = await createAssociatedTokenAccount(ownerPublicKey, mintAddress);
    const tokenAccount = tokenAccountResult.tokenAccount;
    
    // Mint 1 token to represent the pet
    console.log('Minting pet token...');
    await mintPetToken(mintAddress, tokenAccount, ownerPublicKey);
    
    // Store pet in database with on-chain references
    const petWithTokens = petDb.createPet({
      id: petData.id,
      name: petData.name,
      species: petData.species,
      breed: petData.breed,
      age: petData.age,
      owner: ownerAddress,
      mintAddress: mintAddress,
      tokenAccount: tokenAccount
    });
    
    console.log('Pet registered successfully:', petData.id);
    
    res.json({ 
      success: true, 
      pet: petWithTokens,
      message: 'Pet registered successfully with Solana SPL Token',
      onChain: {
        mint: mintAddress,
        tokenAccount: tokenAccount
      }
    });
  } catch (error) {
    console.error('Error registering pet:', error);
    res.status(500).json({ error: `Failed to register pet: ${error.message}` });
  }
});

// GET /api/v1/pettracker/token-info?mint=<mintAddress> - Get token info
router.get('/token-info', async (req, res) => {
  try {
    const { mint } = req.query;
    if (!mint) {
      return res.status(400).json({ error: 'Mint address is required' });
    }
    
    const tokenInfo = await getTokenInfo(mint);
    res.json(tokenInfo);
  } catch (error) {
    console.error('Error getting token info:', error);
    res.status(500).json({ error: 'Failed to get token info' });
  }
});

module.exports = router;
