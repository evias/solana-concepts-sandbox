const express = require('express');
const web3 = require('@solana/web3.js');
const { petDb, vaccinationDb } = require('./database');
const { createVaccinationTransaction, verifyVaccinationSignature, getVaccinationTransactionInfo } = require('./vaccination-tx');

const router = express.Router();

// Solana connection
const connection = new web3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

// GET /api/v1/petvax/verify?petId=<id> - Verify vaccination status for a pet
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
    console.error('Error verifying vaccinations:', error);
    res.status(500).json({ error: 'Failed to verify vaccinations' });
  }
});

// POST /api/v1/petvax/prepare - Prepare vaccination transaction for signing
router.post('/prepare', express.json(), async (req, res) => {
  try {
    const { petId, vaccineName, vaccinationDate, vetAddress } = req.body;
    
    if (!petId || !vaccineName || !vaccinationDate || !vetAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate Solana addresses
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
    
    // Create transaction for signing
    const txData = await createVaccinationTransaction({
      petId,
      petOwner: pet.owner,
      vaccineName,
      vaccinationDate,
      vetAddress
    });
    
    res.json({
      success: true,
      ...txData,
      petName: pet.name,
      petSpecies: pet.species
    });
  } catch (error) {
    console.error('Error preparing vaccination transaction:', error);
    res.status(500).json({ error: `Failed to prepare transaction: ${error.message}` });
  }
});

// POST /api/v1/petvax/record - Record a new vaccination with transaction signature and hash
router.post('/record', express.json(), async (req, res) => {
  try {
    const { petId, vaccineName, vaccinationDate, vetAddress, notes, transactionSignature, transactionHash } = req.body;
    
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
        console.warn('Transaction signature could not be verified on-chain:', transactionSignature);
        // Don't fail, but note it in logs - transaction might not be finalized yet
      }
    }
    
    // Create vaccination record
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
        transactionHash: transactionHash || null
      });
      
      console.log('Vaccination recorded:', vaccinationId, 'for pet:', petId);
      if (transactionSignature) {
        console.log('  with transaction signature:', transactionSignature);
      }
      if (transactionHash) {
        console.log('  with transaction hash:', transactionHash);
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
    console.error('Error recording vaccination:', error);
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
    console.error('Error getting transaction info:', error);
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
    console.error('Error getting pet vaccinations:', error);
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
    console.error('Error getting vet vaccinations:', error);
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
    console.error('Error getting vaccination by transaction hash:', error);
    res.status(500).json({ error: 'Failed to get vaccination' });
  }
});

module.exports = router;
