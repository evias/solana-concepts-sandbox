const express = require('express');
const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const { petDb, vaccinationDb } = require('./database');
const { payer } = require('./payer');
const { 
  createVaccinationTransaction,
  verifyVaccinationSignature,
  getVaccinationTransactionInfo
} = require('./vaccination-tx');
const { createLogger } = require('./logger');
const log = createLogger('concept/petvax');

const router = express.Router();

// Solana connection
const connection = new web3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

/**
 * @swagger
 * /api/v1/petvax/vaccinations:
 *   get:
 *     tags:
 *       - PetVax
 *     summary: Verify vaccination status for a pet
 *     description: Returns all vaccinations recorded for a specific pet, including on-chain proof counts.
 *     parameters:
 *       - in: query
 *         name: petId
 *         required: true
 *         schema:
 *           type: string
 *         description: Pet ID
 *     responses:
 *       200:
 *         description: Vaccination status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pet:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     species: { type: string }
 *                     owner: { type: string }
 *                 vaccinations:
 *                   type: array
 *                   items: { type: object }
 *                 vaccinationCount: { type: number }
 *                 onChainProofs: { type: number }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pet not found
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/verify', async (req, res) => {
  try {
    const { petId } = req.query;
    
    if (!petId) {
      return res.status(400).json({ error: 'Pet ID is required' });
    }
    
    // Check if pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Get all vaccinations for this pet
    const vaccinations = vaccinationDb.getVaccinationsByPetId(petId);
    
    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        owner: pet.owner
      },
      vaccinations: vaccinations,
      vaccinationCount: vaccinations.length,
      onChainProofs: vaccinations.filter(v => v.transaction_signature).length
    });
   } catch (error) {
     log.error('Error verifying vaccinations:', { error: error });
     res.status(500).json({ error: 'Failed to verify vaccinations' });
   }
 });

// POST /api/v1/petvax/record-with-spl - Record vaccination with SPL token using message signing
router.post('/record-with-spl', express.json(), async (req, res) => {
  try {
    const { petId, vaccineName, vaccinationDate, vetAddress, notes, ownerAddress, signedMessage } = req.body;
    
    if (!petId || !vaccineName || !vaccinationDate || !vetAddress || !ownerAddress || !signedMessage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate Solana addresses
    try {
      new web3.PublicKey(vetAddress);
      new web3.PublicKey(ownerAddress);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }
    
     // Verify pet exists and owner matches
     const pet = petDb.getPetById(petId);
     if (!pet) {
       return res.status(404).json({ error: 'Pet not found' });
     }
     
     // Check if requester (ownerAddress) is authorized: either owner or authorized vet
     if (pet.owner !== ownerAddress && !petDb.isVetAuthorizedForPet(petId, ownerAddress)) {
       return res.status(403).json({ error: 'Only pet owner or authorized veterinarian can record vaccinations' });
     }
    
    log.info(`Recording vaccination for pet ${petId} with SPL token...`);
    
    // Create SPL token mint for this vaccination
    log.info(`Creating SPL token mint...`);
    const mint = await splToken.createMint(
      connection,
      payer,
      payer.publicKey,      // Mint authority
      payer.publicKey,      // Freeze authority
      0                     // Decimals
    );
    
    const mintAddress = mint.toBase58();
    log.info(`Token mint created:`, { value: mintAddress });
    
    // Create associated token account for the owner
    log.info(`Creating associated token account...`);
    const ownerPublicKey = new web3.PublicKey(ownerAddress);
    const associatedTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      ownerPublicKey
    );
    
    const tokenAccount = associatedTokenAccount.address.toBase58();
    log.info(`Token account created:`, { value: tokenAccount });
    
    // Mint 1 token to represent this vaccination
    log.info(`Minting vaccination token...`);
    const signature = await splToken.mintTo(
      connection,
      payer,
      mint,
      associatedTokenAccount.address,
      payer,
      1
    );
    
    log.info(`Token minted, signature:`, { value: signature });
    
    // Create vaccination record with token references
    const vaccinationId = 'vax_' + Date.now();
    
     try {
       const vaccination = vaccinationDb.createVaccination({
         id: vaccinationId,
         petId: petId,
         vaccineName: vaccineName,
         vaccinationDate: vaccinationDate,
         vetAddress: vetAddress,
         vetMandateAuthority: vetAddress,
         notes: notes || '',
         mintAddress: mintAddress,           // SPL token mint address
         transactionSignature: signature,    // Token mint transaction signature
         transactionHash: signature          // Use signature as hash for now
       });
      
      log.info(`Vaccination recorded:`, { value: vaccinationId });
      
      res.json({
        success: true,
        vaccination: vaccination,
        message: 'Vaccination recorded on-chain with SPL token',
        onChain: {
          mint: mintAddress,
          tokenAccount: tokenAccount,
          transactionSignature: signature
        },
        metadata: {
          petId: pet.id,
          petName: pet.name,
          vetAddress: vetAddress,
          onChainProof: true,
          transactionSignature: signature,
          solscanUrl: `https://solscan.io/tx/${signature}?cluster=devnet`
        }
      });
    } catch (error) {
      if (error.message.includes('Pet not found')) {
        return res.status(404).json({ error: 'Pet not found' });
      }
      throw error;
    }
  } catch (error) {
    log.error('Error recording vaccination with SPL token:', { error: error });
    res.status(500).json({ error: `Failed to record vaccination: ${error.message}` });
  }
});
 
// POST /api/v1/petvax/prepare - Prepare vaccination transaction for signing
router.post('/prepare', express.json(), async (req, res) => {
  try {
    const { 
      petId, 
      vaccineName, 
      vaccinationDate, 
      vetAddress,
      mustRenew,
      renewalPeriod,
      customRenewalPeriod,
      vaccinationToken,
      vaccineUrl,
      clinicUrl,
      petSignature,
      petName,
      ownerAddress
    } = req.body;
    
    if (!petId || !vaccineName || !vaccinationDate || !vetAddress || !petSignature || !vaccinationToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate Solana addresses
    try {
      new web3.PublicKey(vetAddress);
      if (ownerAddress) new web3.PublicKey(ownerAddress);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }
    
    // Verify pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Create transaction for signing
    const txData = await createVaccinationTransaction({
      petId,
      petName: petName || pet.name,
      petOwner: ownerAddress || pet.owner,
      vaccineName,
      vaccinationDate,
      vetAddress,
      mustRenew: mustRenew || false,
      renewalPeriod: renewalPeriod || '',
      customRenewalPeriod: customRenewalPeriod || '',
      vaccinationToken,
      vaccineUrl: vaccineUrl || null,
      clinicUrl: clinicUrl || null,
      petSignature
    });
    
    res.json({
      success: true,
      ...txData,
      petName: pet.name,
      petSpecies: pet.species
    });
  } catch (error) {
    log.error('Error preparing vaccination transaction:', { error: error });
    res.status(500).json({ error: `Failed to prepare transaction: ${error.message}` });
  }
});

/**
 * @swagger
 * /api/v1/petvax/vaccinations:
 *   post:
 *     tags:
 *       - PetVax
 *     summary: Record a new vaccination
 *     description: Records a new vaccination for a pet with optional transaction signature and hash for on-chain proof.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - petId
 *               - vaccineName
 *               - vaccinationDate
 *               - vetAddress
 *             properties:
 *               petId:
 *                 type: string
 *               vaccineName:
 *                 type: string
 *               vaccinationDate:
 *                 type: string
 *                 format: date
 *               vetAddress:
 *                 type: string
 *                 description: Solana wallet address of veterinarian
 *               notes:
 *                 type: string
 *               mustRenew:
 *                 type: boolean
 *               renewalPeriod:
 *                 type: string
 *               customRenewalPeriod:
 *                 type: string
 *               vaccinationToken:
 *                 type: string
 *               vaccineUrl:
 *                 type: string
 *               clinicUrl:
 *                 type: string
 *               petSignature:
 *                 type: string
 *               transactionSignature:
 *                 type: string
 *               transactionHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vaccination recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 vaccination:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     petId: { type: string }
 *                     vaccineName: { type: string }
 *                     vaccinationDate: { type: string }
 *                     vetAddress: { type: string }
 *                 message: { type: string }
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     petId: { type: string }
 *                     petName: { type: string }
 *                     vetAddress: { type: string }
 *                     onChainProof: { type: boolean }
 *                     transactionHash: { type: string }
 *                     solscanUrl: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         description: Pet not found
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/record', express.json(), async (req, res) => {
  try {
    const { 
      petId, 
      vaccineName, 
      vaccinationDate, 
      vetAddress, 
      notes,
      mustRenew,
      renewalPeriod,
      customRenewalPeriod,
      vaccinationToken,
      vaccineUrl,
      clinicUrl,
      petSignature,
      transactionSignature, 
      transactionHash 
    } = req.body;
    
    if (!petId || !vaccineName || !vaccinationDate || !vetAddress) {
      return res.status(400).json({ error: 'Missing required fields: petId, vaccineName, vaccinationDate, vetAddress' });
    }
    
    // Validate Solana address
    try {
      new web3.PublicKey(vetAddress);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid vet address' });
    }
    
    // Verify pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Validate vaccination date
    const vaxDate = new Date(vaccinationDate);
    if (isNaN(vaxDate.getTime())) {
      return res.status(400).json({ error: 'Invalid vaccination date' });
    }
    
    // Verify transaction signature if provided
    if (transactionSignature) {
      const isValidTx = await verifyVaccinationSignature(transactionSignature, petId);
      if (!isValidTx) {
        log.warn('Transaction signature could not be verified on-chain:', { value: transactionSignature });
        // Don't fail, but note it in logs - transaction might not be finalized yet
      }
    }
    
    // Create vaccination record with new fields
    const vaccinationId = 'vax_' + Date.now();
    
    try {
      const vaccination = vaccinationDb.createVaccination({
        id: vaccinationId,
        petId: petId,
        vaccineName: vaccineName,
        vaccinationDate: vaccinationDate,
        vetAddress: vetAddress,
        vetMandateAuthority: vetAddress,
        notes: notes || '',
        transactionSignature: transactionSignature || null,
        transactionHash: transactionHash || null,
        // New fields stored in notes or as separate columns if schema allows
        customData: JSON.stringify({
          mustRenew: mustRenew || false,
          renewalPeriod: renewalPeriod || '',
          customRenewalPeriod: customRenewalPeriod || '',
          vaccinationToken: vaccinationToken || '',
          vaccineUrl: vaccineUrl || '',
          clinicUrl: clinicUrl || '',
          petSignature: petSignature || ''
        })
      });
      
      log.info('Vaccination recorded', { vaccinationId, petId });
      if (transactionSignature) {
        log.info('with transaction signature', { transactionSignature });
      }
      if (transactionHash) {
        log.info('with transaction hash', { transactionHash });
      }
      
      res.json({
        success: true,
        vaccination: vaccination,
        message: transactionHash ? 'Vaccination recorded on-chain' : (transactionSignature ? 'Vaccination recorded with signature proof' : 'Vaccination recorded'),
        metadata: {
          petId: pet.id,
          petName: pet.name,
          vetAddress: vetAddress,
          onChainProof: !!transactionSignature,
          transactionHash: transactionHash || null,
          solscanUrl: transactionHash ? `https://solscan.io/tx/${transactionHash}?cluster=devnet` : null
        }
      });
    } catch (error) {
      if (error.message.includes('Pet not found')) {
        return res.status(404).json({ error: 'Pet not found' });
      }
      throw error;
    }
  } catch (error) {
    log.error('Error recording vaccination:', { error: error });
    res.status(500).json({ error: `Failed to record vaccination: ${error.message}` });
  }
});

// GET /api/v1/petvax/signature?txSignature=<signature> - Get transaction info
router.get('/signature', async (req, res) => {
  try {
    const { txSignature } = req.query;
    
    if (!txSignature) {
      return res.status(400).json({ error: 'Transaction signature is required' });
    }
    
    const txInfo = await getVaccinationTransactionInfo(txSignature);
    if (!txInfo) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(txInfo);
  } catch (error) {
    log.error('Error getting transaction info:', { error: error });
    res.status(500).json({ error: 'Failed to get transaction info' });
  }
});

// GET /api/v1/petvax/pet?petId=<id> - Get vaccinations for a specific pet
router.get('/pet', async (req, res) => {
  try {
    const { petId } = req.query;
    
    if (!petId) {
      return res.status(400).json({ error: 'Pet ID is required' });
    }
    
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    const vaccinations = vaccinationDb.getVaccinationsByPetId(petId);
    
    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        owner: pet.owner
      },
      vaccinations: vaccinations
    });
  } catch (error) {
    log.error('Error getting pet vaccinations:', { error: error });
    res.status(500).json({ error: 'Failed to get vaccinations' });
  }
});

// GET /api/v1/petvax/vet?vetAddress=<address> - Get vaccinations recorded by a vet
router.get('/vet', async (req, res) => {
  try {
    const { vetAddress } = req.query;
    
    if (!vetAddress) {
      return res.status(400).json({ error: 'Vet address is required' });
    }
    
    // Validate Solana address
    try {
      new web3.PublicKey(vetAddress);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid vet address' });
    }
    
    const vaccinations = vaccinationDb.getVaccinationsByVet(vetAddress);
    
    res.json({
      vetAddress: vetAddress,
      vaccinationCount: vaccinations.length,
      onChainProofs: vaccinations.filter(v => v.transaction_signature).length,
      transactionHashes: vaccinations.filter(v => v.transaction_hash).length,
      vaccinations: vaccinations
    });
  } catch (error) {
    log.error('Error getting vet vaccinations:', { error: error });
    res.status(500).json({ error: 'Failed to get vaccinations' });
  }
});

// GET /api/v1/petvax/tx?hash=<transactionHash> - Get vaccination by transaction hash (for Solscan lookup)
router.get('/tx', async (req, res) => {
  try {
    const { hash } = req.query;
    
    if (!hash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }
    
    const vaccination = vaccinationDb.getVaccinationByTransactionHash(hash);
    if (!vaccination) {
      return res.status(404).json({ error: 'Vaccination not found for this transaction hash' });
    }
    
    // Get pet details
    const pet = petDb.getPetById(vaccination.pet_id);
    
    res.json({
      vaccination: vaccination,
      pet: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        owner: pet.owner
      },
      solscanUrl: `https://solscan.io/tx/${hash}?cluster=devnet`
    });
  } catch (error) {
    log.error('Error getting vaccination by transaction hash:', { error: error });
    res.status(500).json({ error: 'Failed to get vaccination' });
  }
});

module.exports = router;
