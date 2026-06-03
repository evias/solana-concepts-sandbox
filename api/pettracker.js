const express = require('express');
const web3 = require('@solana/web3.js');
const { petDb } = require('./database');
const { createPetTokenMint, createAssociatedTokenAccount, mintPetToken, getTokenInfo } = require('./solana-tokens');
const { createLogger } = require('./logger');
const log = createLogger('concept/pettracker');

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
      log.info('Created account and airdropped SOL:', { value: ownerPublicKey.toBase58() });
    }
    return true;
  } catch (error) {
    log.error('Error ensuring token account exists:', { error: error });
    return false;
  }
}

/**
 * @swagger
 * /api/v1/pettracker/pets:
 *   get:
 *     tags:
 *       - PetTracker
 *     summary: List all pets
 *     description: Returns all pets from the database with their details.
 *     responses:
 *       200:
 *         description: Pets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   name: { type: string }
 *                   species: { type: string }
 *                   breed: { type: string }
 *                   age: { type: number }
 *                   owner: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/list', async (req, res) => {
  try {
    const pets = petDb.getAllPets();
    res.json(pets);
  } catch (error) {
    log.error('Error listing pets:', { error: error });
    res.status(500).json({ error: 'Failed to list pets' });
  }
});

/**
 * @swagger
 * /api/v1/pettracker/pets/{id}:
 *   get:
 *     tags:
 *       - PetTracker
 *     summary: Get a specific pet by ID
 *     description: Returns pet details including name, species, breed, age and owner information.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pet ID
 *     responses:
 *       200:
 *         description: Pet retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 species: { type: string }
 *                 breed: { type: string }
 *                 age: { type: number }
 *                 owner: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pet not found
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
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
    log.error('Error getting pet:', { error: error });
    res.status(500).json({ error: 'Failed to get pet' });
  }
});

/**
 * @swagger
 * /api/v1/pettracker/pets:
 *   post:
 *     tags:
 *       - PetTracker
 *     summary: Create or update a pet
 *     description: Creates a new pet or updates an existing pet's information. Owner authorization required for updates.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - petData
 *               - ownerAddress
 *             properties:
 *               petData:
 *                 type: object
 *                 required:
 *                   - id
 *                 properties:
 *                   id: { type: string }
 *                   name: { type: string }
 *                   species: { type: string }
 *                   breed: { type: string }
 *                   age: { type: number }
 *               ownerAddress:
 *                 type: string
 *                 description: Solana wallet address of pet owner
 *     responses:
 *       200:
 *         description: Pet created or updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 pet:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     species: { type: string }
 *                     breed: { type: string }
 *                     age: { type: number }
 *                     owner: { type: string }
 *                 message: { type: string }
 *                 mandate:
 *                   type: object
 *                   properties:
 *                     authority: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       403:
 *         description: Unauthorized - not pet owner
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
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
      // Verify mandate authority for existing pet
      const mandateCheck = petDb.verifyMandate(petData.id, ownerAddress);
      if (!mandateCheck.valid) {
        return res.status(403).json({ 
          error: 'Unauthorized', 
          reason: mandateCheck.reason 
        });
      }
      
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
        message: 'Pet updated successfully',
        mandate: { authority: ownerAddress }
      });
    } else {
      // Create new pet (without on-chain token)
      const newPet = petDb.createPet({
        id: petData.id,
        name: petData.name,
        species: petData.species,
        breed: petData.breed,
        age: petData.age,
        owner: ownerAddress,
        mandateAuthority: ownerAddress
      });
      
      return res.json({ 
        success: true, 
        pet: newPet,
        message: 'Pet created successfully',
        mandate: { authority: ownerAddress }
      });
    }
  } catch (error) {
    log.error('Error editing pet:', { error: error });
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
    
    // Verify mandate authority for deletion
    const mandateCheck = petDb.verifyMandate(id, ownerAddress);
    if (!mandateCheck.valid) {
      return res.status(403).json({ 
        error: 'Unauthorized', 
        reason: mandateCheck.reason 
      });
    }
    
    // Delete from database
    petDb.deletePet(id);
    
    // Note: In a real implementation, you might also burn the token or transfer it
    // For now, we'll just archive it in the database
    
    res.json({ success: true, deletedId: id });
  } catch (error) {
    log.error('Error deleting pet:', { error: error });
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
    
    log.info(`Registering pet ${petData.id} for owner ${ownerAddress}...`);
    
    // Ensure the owner's account exists on-chain
    await ensureTokenAccountExists(ownerPublicKey);
    
    // Create an SPL Token mint for the pet
    log.info('Creating SPL Token mint...');
    const mintResult = await createPetTokenMint(ownerPublicKey);
    const mintAddress = mintResult.mintAddress;
    
    // Create associated token account for the owner
    log.info('Creating associated token account...');
    const tokenAccountResult = await createAssociatedTokenAccount(ownerPublicKey, mintAddress);
    const tokenAccount = tokenAccountResult.tokenAccount;
    
    // Mint 1 token to represent the pet
    log.info('Minting pet token...');
    await mintPetToken(mintAddress, tokenAccount, ownerPublicKey);
    
    // Store pet in database with on-chain references
    const petWithTokens = petDb.createPet({
      id: petData.id,
      name: petData.name,
      species: petData.species,
      breed: petData.breed,
      age: petData.age,
      owner: ownerAddress,
      mandateAuthority: ownerAddress,
      mintAddress: mintAddress,
      tokenAccount: tokenAccount
    });
    
    log.info('Pet registered successfully:', { value: petData.id });
    
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
    log.error('Error registering pet:', { error: error });
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
    log.error('Error getting token info:', { error: error });
    res.status(500).json({ error: 'Failed to get token info' });
  }
});

// GET /api/v1/pettracker/verify-mandate?petId=<id>&authority=<address> - Verify mandate authority
router.get('/verify-mandate', async (req, res) => {
  try {
    const { petId, authority } = req.query;
    
    if (!petId) {
      return res.status(400).json({ error: 'Pet ID is required' });
    }
    
    if (!authority) {
      return res.status(400).json({ error: 'Authority address is required' });
    }
    
    // Validate Solana address
    try {
      new web3.PublicKey(authority);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }
    
    // Verify mandate
    const mandateCheck = petDb.verifyMandate(petId, authority);
    
    if (mandateCheck.valid) {
      const mandateInfo = petDb.getMandateInfo(petId);
      res.json({ 
        valid: true,
        authority: authority,
        mandate: mandateInfo
      });
    } else {
      res.status(403).json({ 
        valid: false,
        authority: authority,
        reason: mandateCheck.reason
      });
    }
  } catch (error) {
    log.error('Error verifying mandate:', { error: error });
    res.status(500).json({ error: 'Failed to verify mandate' });
  }
});

// POST /authorize-vet - Add authorized veterinary to a pet
router.post('/authorize-vet', express.json(), async (req, res) => {
  const { petId, ownerAddress, vetAddress } = req.body;

  // Validation
  if (!petId || !ownerAddress || !vetAddress) {
    return res.status(400).json({
      error: 'Missing required fields: petId, ownerAddress, vetAddress'
    });
  }

  try {
    // Validate Solana addresses
    new web3.PublicKey(ownerAddress);
    new web3.PublicKey(vetAddress);
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid Solana address format',
      details: error.message
    });
  }

  try {
    // Check pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return res.status(404).json({
        error: 'Pet not found',
        petId
      });
    }

    // Verify mandate (owner can authorize vets)
    const mandate = petDb.verifyMandate(petId, ownerAddress);
    if (!mandate.valid) {
      return res.status(403).json({
        error: 'Unauthorized',
        reason: mandate.reason
      });
    }

    // Parse current authorized vets
    const currentVets = JSON.parse(pet.authorizedVets || '[]');

    // Check if vet already authorized
    if (currentVets.includes(vetAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Veterinary already authorized for this pet'
      });
    }

    // Get payer for SAS operations
    const payer = require('./payer').getPayerKeypair();

    // SAS Integration: Ensure credential exists or create
    const sasIntegration = require('./sas-integration');
    log.info(`Ensuring credential for owner ${ownerAddress}...`);
    const sasResult = await sasIntegration.ensureSasCredential(ownerAddress, payer);
    log.info(`Credential ${sasResult.credentialAddress} exists: ${sasResult.exists}`);

    // If credential exists, add the new signer
    if (sasResult.exists) {
      log.info(`Adding signer ${vetAddress} to credential ${sasResult.credentialAddress}...`);
      try {
        const addResult = await sasIntegration.addAuthorizedSigner(
          sasResult.credentialAddress,
          ownerAddress,
          vetAddress,
          payer
        );
        sasResult.transactionSignature = addResult.transactionSignature;
        sasResult.authorizedSigners = addResult.authorizedSigners;
        log.info(`Signer added successfully. Tx: ${addResult.transactionSignature}`);
      } catch (addError) {
        log.error('Error adding signer:', { error: addError.message });
        // If error is "signer already authorized", continue anyway
        if (!addError.message.includes('Signer already authorized')) {
          throw addError;
        }
        log.info('Signer was already added, continuing...');
        sasResult.authorizedSigners = [...currentVets, vetAddress];
      }
    }

    // Update database with new vet
    const updatedVets = [...currentVets, vetAddress];
    petDb.updatePet(petId, { authorizedVets: JSON.stringify(updatedVets) });

    // Get updated pet
    const updatedPet = petDb.getPetById(petId);

    res.json({
      success: true,
      pet: updatedPet,
      sasCredential: {
        address: sasResult.credentialAddress,
        owner: ownerAddress,
        authorizedSigners: sasResult.authorizedSigners,
        exists: sasResult.exists,
        transactionSignature: sasResult.transactionSignature
      },
      message: 'Veterinary authorized successfully'
    });
  } catch (error) {
    log.error('Error authorizing veterinary:', { error: error });
    res.status(500).json({
      error: 'Failed to authorize veterinary',
      details: error.message
    });
  }
});

module.exports = router;
