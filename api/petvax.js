const express = require('express');
const web3 = require('@solana/web3.js');
const { petDb, vaccinationDb } = require('./database');

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
      vaccinationCount: vaccinations.length
    });
  } catch (error) {
    console.error('Error verifying vaccinations:', error);
    res.status(500).json({ error: 'Failed to verify vaccinations' });
  }
});

// POST /api/v1/petvax/record - Record a new vaccination
router.post('/record', express.json(), async (req, res) => {
  try {
    const { petId, vaccineName, vaccinationDate, vetAddress, notes } = req.body;
    
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
        notes: notes || ''
      });
      
      console.log('Vaccination recorded:', vaccinationId, 'for pet:', petId);
      
      res.json({
        success: true,
        vaccination: vaccination,
        message: 'Vaccination recorded successfully',
        metadata: {
          petId: pet.id,
          petName: pet.name,
          vetAddress: vetAddress
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
      vaccinations: vaccinations
    });
  } catch (error) {
    console.error('Error getting vet vaccinations:', error);
    res.status(500).json({ error: 'Failed to get vaccinations' });
  }
});

module.exports = router;
