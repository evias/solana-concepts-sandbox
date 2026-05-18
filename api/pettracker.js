const express = require('express');
const router = express.Router();

// Mock pet data store
let pets = [];

// GET /api/v1/pettracker/list - List all pets
router.get('/list', (req, res) => {
  res.json(pets);
});

// GET /api/v1/pettracker/get?id=<petId> - Get pet by ID
router.get('/get', (req, res) => {
  const petId = req.query.id;
  const pet = pets.find(p => p.id === petId);
  if (!pet) {
    return res.status(404).json({ error: 'Pet not found' });
  }
  res.json(pet);
});

// POST /api/v1/pettracker/edit - Add or update a pet
router.post('/edit', express.json(), (req, res) => {
  const petData = req.body;
  if (!petData || !petData.id) {
    return res.status(400).json({ error: 'Invalid pet data or missing id' });
  }
  const existingIndex = pets.findIndex(p => p.id === petData.id);
  if (existingIndex >= 0) {
    pets[existingIndex] = petData; // Update existing
  } else {
    pets.push(petData); // Add new
  }
  res.json({ success: true, pet: petData });
});

// POST /api/v1/pettracker/delete - Delete a pet
router.post('/delete', express.json(), (req, res) => {
  const petId = req.body.id;
  if (!petId) {
    return res.status(400).json({ error: 'Pet ID is required' });
  }
  pets = pets.filter(p => p.id !== petId);
  res.json({ success: true, deletedId: petId });
});

module.exports = router;
