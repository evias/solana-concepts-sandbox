/**
 * PetDiet Integration Tests
 * Tests for complete nutrition plan and feeding action workflows
 */

jest.mock('@solana/web3.js', () => ({
  PublicKey: class {
    constructor(address) {
      this.address = address;
    }
    toString() {
      return this.address;
    }
    toBase58() {
      return this.address;
    }
  },
  Transaction: class {
    constructor() {
      this.instructions = [];
      this.signatures = [];
      this.recentBlockhash = '';
      this.feePayer = null;
    }
    add(instruction) {
      this.instructions.push(instruction);
      return this;
    }
    sign(keypair) {
      this.signatures.push({ publicKey: {} });
      return this;
    }
    serialize() {
      return { toString: () => Buffer.from('mock').toString('base64') };
    }
  },
  TransactionInstruction: class {
    constructor(data) {
      this.programId = data.programId;
      this.keys = data.keys;
      this.data = data.data;
    }
  },
  Connection: class {
    constructor() {}
    getAccountInfo() {
      return Promise.resolve({ executable: true });
    }
    getLatestBlockhash() {
      return Promise.resolve({ blockhash: 'test_blockhash', lastValidBlockHeight: 999 });
    }
    sendRawTransaction() {
      return Promise.resolve('mock_tx_signature_' + Date.now());
    }
    confirmTransaction() {
      return Promise.resolve({ value: { err: null } });
    }
  }
}));

jest.mock('@solana/spl-token', () => ({
  createMint: jest.fn().mockResolvedValue({
    toBase58: () => 'mock_mint_' + Date.now()
  }),
  getOrCreateAssociatedTokenAccount: jest.fn().mockResolvedValue({
    address: {
      toBase58: () => 'mock_ata_' + Date.now()
    }
  }),
  mintTo: jest.fn().mockResolvedValue('mock_mint_tx_' + Date.now())
}));

jest.mock('../api/payer', () => ({
  payer: {
    publicKey: { toBase58: () => 'payer_address_test' }
  }
}));

const request = require('supertest');
const express = require('express');
const { petDb, nutritionPlanDb, feedingActionDb } = require('../api/database');

const petdietRouter = require('../api/petdiet');
const app = express();
app.use(express.json());
app.use('/api/v1/petdiet', petdietRouter);

describe('PetDiet Integration Tests', () => {
  let testPet;
  const testOwnerPrefix = 'jest_petdiet_integration_' + Date.now();
  let createdPetIds = []; // Track all created pets for cleanup

  beforeAll(() => {
    testPet = petDb.createPet({
      id: `pet_${testOwnerPrefix}_${Date.now()}`,
      name: 'Integration Test Pet',
      species: 'Dog',
      breed: 'Test Breed',
      age: 5,
      owner: testOwnerPrefix,
      mandateAuthority: 'test_authority_integration'
    });
    createdPetIds.push(testPet.id); // Track for cleanup
  });

  afterAll(() => {
    // Cleanup all test data (including other_owner pets)
    try {
      const db = require('../api/database').db;
      
      // Cleanup all created pets and related data
      for (const petId of createdPetIds) {
        const plans = nutritionPlanDb.getNutritionPlansByPetId(petId);
        if (plans) {
          for (const plan of plans) {
            db.prepare('DELETE FROM feeding_actions WHERE nutrition_plan_id = ?').run(plan.id);
            db.prepare('DELETE FROM nutrition_plans WHERE id = ?').run(plan.id);
          }
        }
        db.prepare('DELETE FROM pets WHERE id = ?').run(petId);
      }
      
      // Cleanup any other_owner pets that may have been created during tests
      db.prepare("DELETE FROM nutrition_plans WHERE pet_id IN (SELECT id FROM pets WHERE owner = 'other_owner')").run();
      db.prepare("DELETE FROM feeding_actions WHERE pet_id IN (SELECT id FROM pets WHERE owner = 'other_owner')").run();
      db.prepare("DELETE FROM pets WHERE owner = 'other_owner'").run();
    } catch (err) {
      // Silently ignore cleanup errors
    }
  });

  describe('Nutrition Plan Workflow', () => {
    test('should create nutrition plan with all ingredients filled', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'Complete Weekly Plan',
          startDate: '2026-05-26',
          duration: '1 month',
          durationEndDate: '2026-06-26',
          ownerAddress: testPet.owner,
          ingredientsMonday: 'Chicken, Rice, Carrots',
          ingredientsTuesday: 'Beef, Sweet Potato, Broccoli',
          ingredientsWednesday: 'Fish, Oats, Green Beans',
          ingredientsThursday: 'Turkey, Barley, Peas',
          ingredientsFriday: 'Lamb, Quinoa, Spinach',
          ingredientsSaturday: 'Chicken, Brown Rice, Kale',
          ingredientsSunday: 'Mixed Vegetables, Whole Grain'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.plan).toBeDefined();
      expect(res.body.onChain.mint).toBeDefined();
      expect(res.body.onChain.tokenTransactionSignature).toBeDefined();
      expect(res.body.onChain.memoTransactionSignature).toBeDefined();
      expect(res.body.metadata.transactionHash).toBeDefined();
      expect(res.body.metadata.solscanUrl).toContain('solscan.io');
    });

    test('should create nutrition plan with partial ingredients (auto-fill)', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'Partial Ingredients Plan',
          startDate: '2026-05-26',
          duration: '2 weeks',
          durationEndDate: '2026-06-09',
          ownerAddress: testPet.owner,
          ingredientsMonday: 'Chicken, Rice',
          ingredientsTuesday: '',
          ingredientsWednesday: '',
          ingredientsThursday: '',
          ingredientsFriday: 'Fish, Oats',
          ingredientsSaturday: '',
          ingredientsSunday: ''
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.plan).toBeDefined();
      // Verify auto-fill worked
      expect(res.body.plan.ingredients_tuesday).toBe('Chicken, Rice'); // Auto-filled from Monday
      expect(res.body.plan.ingredients_friday).toBe('Fish, Oats');
      expect(res.body.plan.ingredients_saturday).toBe('Fish, Oats'); // Auto-filled from Friday
      expect(res.body.plan.ingredients_sunday).toBe('Fish, Oats'); // Auto-filled from Friday
    });

    test('should create nutrition plan with optional nutritioner address', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'Plan with Nutritioner',
          startDate: '2026-05-26',
          duration: '3 months',
          durationEndDate: '2026-08-26',
          ownerAddress: testPet.owner,
          authorizedNutritioner: 'nutritioner_test_address',
          ingredientsMonday: 'Specialized Diet'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.plan.authorized_nutritioner).toBe('nutritioner_test_address');
    });

    test('should reject plan without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id
          // Missing required fields
        })
        .expect(400);

      expect(res.body.error).toContain('Missing required fields');
    });

    test('should reject plan without any ingredients', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'No Ingredients Plan',
          startDate: '2026-05-26',
          duration: '1 month',
          durationEndDate: '2026-06-26',
          ownerAddress: testPet.owner,
          ingredientsMonday: '',
          ingredientsTuesday: '',
          ingredientsWednesday: '',
          ingredientsThursday: '',
          ingredientsFriday: '',
          ingredientsSaturday: '',
          ingredientsSunday: ''
        })
        .expect(400);

      expect(res.body.error).toContain('At least one day of ingredients must be provided');
    });

    test('should reject plan if not pet owner', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'Unauthorized Plan',
          startDate: '2026-05-26',
          duration: '1 month',
          durationEndDate: '2026-06-26',
          ownerAddress: 'different_owner',
          ingredientsMonday: 'Chicken'
        })
        .expect(403);

      expect(res.body.error).toContain('Only pet owner can create nutrition plans');
    });

    test('should retrieve nutrition plans for a pet', async () => {
      // Create a plan first
      const createRes = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'Retrievable Plan',
          startDate: '2026-05-26',
          duration: '1 month',
          durationEndDate: '2026-06-26',
          ownerAddress: testPet.owner,
          ingredientsMonday: 'Chicken'
        })
        .expect(200);

      // Retrieve plans
      const getRes = await request(app)
        .get(`/api/v1/petdiet/plans?petId=${testPet.id}`)
        .expect(200);

      expect(Array.isArray(getRes.body)).toBe(true);
      expect(getRes.body.length).toBeGreaterThan(0);
      
      const foundPlan = getRes.body.find(p => p.plan_name === 'Retrievable Plan');
      expect(foundPlan).toBeDefined();
      expect(foundPlan.mint_address).toBeDefined();
      expect(foundPlan.transaction_hash).toBeDefined();
    });

    test('should include both token and memo transaction signatures', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'Dual TX Plan',
          startDate: '2026-05-26',
          duration: '1 month',
          durationEndDate: '2026-06-26',
          ownerAddress: testPet.owner,
          ingredientsMonday: 'Chicken'
        })
        .expect(200);

      // Should have both signatures
      expect(res.body.onChain.tokenTransactionSignature).toBeDefined();
      expect(res.body.onChain.memoTransactionSignature).toBeDefined();
      
      // Memo tx should be different from token tx (in real scenarios)
      expect(res.body.onChain.tokenTransactionSignature).not.toBeNull();
      expect(res.body.onChain.memoTransactionSignature).not.toBeNull();
    });
  });

  describe('Feeding Action Workflow', () => {
    let testPlan;

    beforeAll(() => {
      testPlan = nutritionPlanDb.createNutritionPlan({
        id: `diet_feeding_test_${Date.now()}`,
        petId: testPet.id,
        planName: 'Feeding Test Plan',
        startDate: '2026-05-26',
        ingredientsMonday: 'Test Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2026-06-26',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'test_sig',
        transactionHash: 'test_hash'
      });
    });

    test('should record feeding action successfully', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/feed')
        .send({
          nutritionPlanId: testPlan.id,
          petId: testPet.id,
          ingredients: 'Test Chicken, Rice',
          userAddress: testPet.owner,
          petSignature: 'mock_pet_signature_123'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.onChain.transactionSignature).toBeDefined();
      expect(res.body.metadata.solscanUrl).toContain('solscan.io');
    });

    test('should reject feeding action with missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/feed')
        .send({
          nutritionPlanId: testPlan.id
          // Missing other fields
        })
        .expect(400);

      expect(res.body.error).toContain('Missing required fields');
    });

    test('should retrieve feeding history for a plan', async () => {
      // Record a feeding action first
      await request(app)
        .post('/api/v1/petdiet/feed')
        .send({
          nutritionPlanId: testPlan.id,
          petId: testPet.id,
          ingredients: 'Recorded Meal',
          userAddress: testPet.owner,
          petSignature: 'signature_for_history'
        });

      // Get feeding history
      const res = await request(app)
        .get(`/api/v1/petdiet/feeding-history?planId=${testPlan.id}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      
      const foundAction = res.body.find(a => a.ingredients === 'Recorded Meal');
      expect(foundAction).toBeDefined();
      expect(foundAction.pet_signature).toBe('signature_for_history');
    });

    test('should return empty feeding history for new plan', async () => {
      const newPlan = nutritionPlanDb.createNutritionPlan({
        id: `diet_empty_history_${Date.now()}`,
        petId: testPet.id,
        planName: 'Empty History Plan',
        startDate: '2026-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2026-06-26',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'test_sig',
        transactionHash: 'test_hash'
      });

      const res = await request(app)
        .get(`/api/v1/petdiet/feeding-history?planId=${newPlan.id}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent pet', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: 'non_existent_pet',
          planName: 'Plan',
          startDate: '2026-05-26',
          duration: '1 month',
          durationEndDate: '2026-06-26',
          ownerAddress: testPet.owner,
          ingredientsMonday: 'Chicken'
        })
        .expect(404);

      expect(res.body.error).toContain('Pet not found');
    });

    test('should return 400 for missing planId in feeding history', async () => {
      const res = await request(app)
        .get('/api/v1/petdiet/feeding-history')
        .expect(400);

      expect(res.body.error).toBe('planId is required');
    });

    test('should return 404 for non-existent plan in feeding history', async () => {
      const res = await request(app)
        .get('/api/v1/petdiet/feeding-history?planId=non_existent_plan')
        .expect(404);

      expect(res.body.error).toContain('Nutrition plan not found');
    });

    test('should return 404 when feeding for non-existent plan', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/feed')
        .send({
          nutritionPlanId: 'non_existent_plan',
          petId: testPet.id,
          ingredients: 'Chicken',
          userAddress: testPet.owner,
          petSignature: 'sig'
        })
        .expect(404);

      expect(res.body.error).toContain('Nutrition plan not found');
    });

    test('should return 400 when feeding plan not linked to pet', async () => {
      const otherPet = petDb.createPet({
        id: `pet_other_${Date.now()}`,
        name: 'Other Pet',
        species: 'Cat',
        breed: 'Siamese',
        age: 2,
        owner: 'other_owner',
        mandateAuthority: 'other_authority'
      });
      createdPetIds.push(otherPet.id); // Track for cleanup

      const plan = nutritionPlanDb.createNutritionPlan({
        id: `diet_mismatch_${Date.now()}`,
        petId: testPet.id,
        planName: 'Mismatched Plan',
        startDate: '2026-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2026-06-26',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'test_sig',
        transactionHash: 'test_hash'
      });

      const res = await request(app)
        .post('/api/v1/petdiet/feed')
        .send({
          nutritionPlanId: plan.id,
          petId: otherPet.id,
          ingredients: 'Chicken',
          userAddress: testPet.owner,
          petSignature: 'sig'
        })
        .expect(400);

      expect(res.body.error).toContain('not linked to this pet');
    });
  });

  describe('Data Persistence', () => {
    test('created nutrition plans persist in database', async () => {
      const planName = `Persistent Plan ${Date.now()}`;
      
      const createRes = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: planName,
          startDate: '2026-05-26',
          duration: '1 month',
          durationEndDate: '2026-06-26',
          ownerAddress: testPet.owner,
          ingredientsMonday: 'Persistent Chicken'
        })
        .expect(200);

      const planId = createRes.body.plan.id;

      // Verify can retrieve it
      const getRes = await request(app)
        .get(`/api/v1/petdiet/plans?petId=${testPet.id}`)
        .expect(200);

      const found = getRes.body.find(p => p.id === planId);
      expect(found).toBeDefined();
      expect(found.plan_name).toBe(planName);
    });

    test('feeding actions persist in database', async () => {
      const plan = nutritionPlanDb.createNutritionPlan({
        id: `diet_persist_feeding_${Date.now()}`,
        petId: testPet.id,
        planName: 'Persistent Feeding Plan',
        startDate: '2026-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2026-06-26',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'test_sig',
        transactionHash: 'test_hash'
      });

      const feedingIngredients = `Persistent Feed ${Date.now()}`;

      await request(app)
        .post('/api/v1/petdiet/feed')
        .send({
          nutritionPlanId: plan.id,
          petId: testPet.id,
          ingredients: feedingIngredients,
          userAddress: testPet.owner,
          petSignature: 'persist_sig'
        })
        .expect(200);

      // Verify can retrieve it
      const getRes = await request(app)
        .get(`/api/v1/petdiet/feeding-history?planId=${plan.id}`)
        .expect(200);

      const found = getRes.body.find(a => a.ingredients === feedingIngredients);
      expect(found).toBeDefined();
      expect(found.pet_signature).toBe('persist_sig');
    });
  });
});
