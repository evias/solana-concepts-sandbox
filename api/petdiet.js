const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { petDb, nutritionPlanDb, feedingActionDb, db } = require('./database');
const sasIntegration = require('./sas-integration');
const payer = require('./payer');

// GET /api/v1/petdiet/plans - Get nutrition plans for a pet
router.get('/plans', async (req, res) => {
  try {
    const { petId } = req.query;

    if (!petId) {
      return res.status(400).json({ error: 'petId is required' });
    }

    // Verify pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    // Get nutrition plans for this pet
    const plans = nutritionPlanDb.getNutritionPlansByPetId(petId);
    
    res.json(plans);
  } catch (error) {
    console.error('Error getting nutrition plans:', error);
    res.status(500).json({ error: `Failed to get nutrition plans: ${error.message}` });
  }
});

// TODO: Implement remaining endpoints

// POST /api/v1/petdiet/create-plan - Create a new nutrition plan with SPL token minting
router.post('/create-plan', express.json(), async (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

// POST /api/v1/petdiet/feed - Record a feeding action
router.post('/feed', express.json(), async (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

// GET /api/v1/petdiet/feeding-history - Get feeding actions for a nutrition plan
router.get('/feeding-history', async (req, res) => {
  try {
    const { planId } = req.query;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    // Verify nutrition plan exists
    const plan = nutritionPlanDb.getNutritionPlanById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Nutrition plan not found' });
    }

    // Get feeding actions for this plan
    const feedingActions = feedingActionDb.getFeedingActionsByPlanId(planId);
    
    res.json(feedingActions);
  } catch (error) {
    console.error('Error getting feeding history:', error);
    res.status(500).json({ error: `Failed to get feeding history: ${error.message}` });
  }
});

module.exports = router;
