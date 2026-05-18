const express = require('express');
const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');

const router = express.Router();

// In-memory cache for pets (in a real implementation, this would be on Solana)
let petCache = new Map();

// Solana connection
const connection = new web3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

// Function to ensure token account exists
async function ensureTokenAccountExists(payerKeypair, ownerPublicKey) {
  try {
    // Check if account exists
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

// GET /api/v1/pettracker/list - List all pets
router.get('/list', async (req, res) => {
  try {
    // In a real implementation, you would fetch from Solana
    // For now, we'll return the cached data
    const pets = Array.from(petCache.values());
    res.json(pets);
  } catch (error) {
    console.error('Error listing pets:', error);
    res.status(500).json({ error: 'Failed to list pets' });
  }
});

// GET /api/v1/pettracker/get?id=<petId> - Get pet by ID
router.get('/get', async (req, res) => {
  try {
    const petId = req.query.id;
    if (!petId) {
      return res.status(400).json({ error: 'Pet ID is required' });
    }
    
    // Check cache first
    const pet = petCache.get(petId);
    if (pet) {
      return res.json(pet);
    }
    
    // In a real implementation, you would fetch from Solana
    return res.status(404).json({ error: 'Pet not found' });
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
    
    // Ensure token account exists for the owner
    // In a real implementation, you would use the owner's actual keypair
    // For this demo, we'll use a placeholder
    const payerKeypair = web3.Keypair.generate();
    
    // For demo purposes, we'll skip the actual account creation
    // In a real implementation, you would:
    // await ensureTokenAccountExists(payerKeypair, ownerPublicKey, connection);
    
    // Store pet in cache (in a real implementation, you would store on Solana)
    const currentTime = new Date().toISOString();
    petCache.set(petData.id, {
      ...petData,
      owner: ownerAddress,
      createdAt: petData.createdAt || currentTime,
      updatedAt: currentTime
    });
    
    res.json({ 
      success: true, 
      pet: { 
        ...petData, 
        owner: ownerAddress,
        createdAt: petData.createdAt || currentTime,
        updatedAt: currentTime
      } 
    });
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
    const pet = petCache.get(id);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    if (pet.owner !== ownerAddress) {
      return res.status(403).json({ error: 'Not authorized to delete this pet' });
    }
    
    // Remove from cache
    petCache.delete(id);
    
    // In a real implementation, you would also remove from Solana
    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting pet:', error);
    res.status(500).json({ error: 'Failed to delete pet' });
  }
});

// POST /api/v1/pettracker/register - Register a new pet with Solana token account
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
    
    // Create a new token account for the pet
    // In a real implementation, you would:
    // 1. Create an SPL Token mint for the pet
    // 2. Create an associated token account for the owner
    // 3. Mint tokens to represent the pet
    
    // For demo purposes, we'll just store the pet with owner info
    const currentTime = new Date().toISOString();
    const petWithOwner = {
      ...petData,
      owner: ownerAddress,
      tokenId: `pet_${petData.id}_${Date.now()}`, // Placeholder token ID
      createdAt: currentTime,
      updatedAt: currentTime
    };
    
    // Store in cache
    petCache.set(petData.id, petWithOwner);
    
    res.json({ 
      success: true, 
      pet: petWithOwner,
      message: 'Pet registered successfully with Solana token account'
    });
  } catch (error) {
    console.error('Error registering pet:', error);
    res.status(500).json({ error: 'Failed to register pet' });
  }
});

module.exports = router;