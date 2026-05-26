/**
 * PetDiet API Tests
 * Tests for PetDiet endpoints (GET plans, GET feeding-history, POST create-plan, POST feed)
 */

jest.mock('@solana/web3.js', () => ({
  PublicKey: class {
    constructor(address) {
      // Accept any string as valid for testing purposes
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

// Create a test server with the PetDiet router
const petdietRouter = require('../api/petdiet');
const app = express();
app.use(express.json());
app.use('/api/v1/petdiet', petdietRouter);

describe('PetDiet API Endpoints', () => {
  let testPet, testPlan;

  beforeAll(() => {
    // Create a test pet
    testPet = petDb.createPet({
      id: `pet_test_${Date.now()}`,
      name: 'Test Pet',
      species: 'Dog',
      breed: 'Labrador',
      age: 3,
      owner: 'test_owner_simple',
      mandateAuthority: 'test_authority_' + Date.now()
    });
  });

  // GET /plans tests
  describe('GET /plans', () => {
    test('should return 400 if petId is missing', async () => {
      const res = await request(app)
        .get('/api/v1/petdiet/plans')
        .expect(400);

      expect(res.body.error).toBe('petId is required');
    });

    test('should return 404 if pet does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/petdiet/plans?petId=non_existent_pet')
        .expect(404);

      expect(res.body.error).toContain('Pet not found');
    });

    test('should return empty array for pet with no plans', async () => {
      const res = await request(app)
        .get(`/api/v1/petdiet/plans?petId=${testPet.id}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    test('should return nutrition plans for a pet', async () => {
      // Create a test plan
      const planId = `diet_${Date.now()}`;
      testPlan = nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: testPet.id,
        planName: 'Test Nutrition Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2024-06-26',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'test_sig',
        transactionHash: 'test_hash'
      });

      const res = await request(app)
        .get(`/api/v1/petdiet/plans?petId=${testPet.id}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const plan = res.body.find(p => p.id === planId);
      expect(plan).toBeDefined();
      expect(plan.plan_name).toBe('Test Nutrition Plan');
    });
  });

  // GET /feeding-history tests
  describe('GET /feeding-history', () => {
    test('should return 400 if planId is missing', async () => {
      const res = await request(app)
        .get('/api/v1/petdiet/feeding-history')
        .expect(400);

      expect(res.body.error).toBe('planId is required');
    });

    test('should return 404 if plan does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/petdiet/feeding-history?planId=non_existent_plan')
        .expect(404);

      expect(res.body.error).toContain('Nutrition plan not found');
    });

    test('should return empty array for plan with no feeding actions', async () => {
      const planId = `diet_${Date.now()}`;
      nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: testPet.id,
        planName: 'Plan Without Actions',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2024-06-26',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      const res = await request(app)
        .get(`/api/v1/petdiet/feeding-history?planId=${planId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    test('should return feeding actions for a plan', async () => {
      const planId = `diet_${Date.now()}`;
      const plan = nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: testPet.id,
        planName: 'Plan With Actions',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2024-06-26',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      // Create some feeding actions
      const actionId = `action_${Date.now()}`;
      feedingActionDb.createFeedingAction({
        id: actionId,
        nutritionPlanId: planId,
        petId: testPet.id,
        ingredients: 'Chicken, Rice',
        petSignature: 'pet_sig',
        transactionSignature: 'tx_sig',
        transactionHash: 'tx_hash'
      });

      const res = await request(app)
        .get(`/api/v1/petdiet/feeding-history?planId=${planId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const action = res.body.find(a => a.id === actionId);
      expect(action).toBeDefined();
      expect(action.ingredients).toBe('Chicken, Rice');
    });
  });

  // POST /create-plan tests
  describe('POST /create-plan', () => {
    test('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({ petId: testPet.id })
        .expect(400);

      expect(res.body.error).toContain('Missing required fields');
    });

    test('should return 400 if no ingredients are provided', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'Bad Plan',
          startDate: '2024-05-26',
          duration: '1 month',
          durationEndDate: '2024-06-26',
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

    test('should return 404 if pet does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: 'non_existent_pet',
          planName: 'Plan',
          startDate: '2024-05-26',
          duration: '1 month',
          durationEndDate: '2024-06-26',
          ownerAddress: testPet.owner,
          ingredientsMonday: 'Chicken'
        })
        .expect(404);

      expect(res.body.error).toContain('Pet not found');
    });

    test('should return 403 if user is not pet owner', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'Plan',
          startDate: '2024-05-26',
          duration: '1 month',
          durationEndDate: '2024-06-26',
          ownerAddress: 'different_owner_simple',
          ingredientsMonday: 'Chicken'
        })
        .expect(403);

      expect(res.body.error).toContain('Only pet owner can create nutrition plans');
    });

    test('should create a nutrition plan successfully', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/create-plan')
        .send({
          petId: testPet.id,
          planName: 'Summer Wellness Plan',
          startDate: '2024-05-26',
          duration: '1 month',
          durationEndDate: '2024-06-26',
          ownerAddress: testPet.owner,
          ingredientsMonday: 'Chicken, Rice',
          ingredientsTuesday: 'Beef, Vegetables',
          ingredientsWednesday: 'Fish, Sweet Potato',
          ingredientsThursday: 'Chicken, Brown Rice',
          ingredientsFriday: 'Turkey, Oats',
          ingredientsSaturday: 'Lamb, Barley',
          ingredientsSunday: 'Mixed Vegetables'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.onChain.mint).toBeDefined();
      expect(res.body.onChain.tokenAccount).toBeDefined();
      expect(res.body.onChain.transactionSignature).toBeDefined();
      expect(res.body.metadata.solscanUrl).toContain('solscan.io');
    });
  });

  // POST /feed tests
  describe('POST /feed', () => {
    let feedPlan;

    beforeAll(() => {
      feedPlan = nutritionPlanDb.createNutritionPlan({
        id: `diet_${Date.now()}_feed`,
        petId: testPet.id,
        planName: 'Feed Test Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2024-06-26',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });
    });

    test('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/feed')
        .send({ nutritionPlanId: feedPlan.id })
        .expect(400);

      expect(res.body.error).toContain('Missing required fields');
    });

    test('should return 404 if nutrition plan does not exist', async () => {
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

    test('should return 404 if pet does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/feed')
        .send({
          nutritionPlanId: feedPlan.id,
          petId: 'non_existent_pet',
          ingredients: 'Chicken',
          userAddress: testPet.owner,
          petSignature: 'sig'
        })
        .expect(404);

      expect(res.body.error).toContain('Pet not found');
    });

    test('should return 400 if plan is not linked to pet', async () => {
      const otherPet = petDb.createPet({
        id: `pet_other_${Date.now()}`,
        name: 'Other Pet',
        species: 'Cat',
        breed: 'Siamese',
        age: 2,
        owner: 'other_owner_' + Date.now(),
        mandateAuthority: 'other_authority_' + Date.now()
      });

      const res = await request(app)
        .post('/api/v1/petdiet/feed')
        .send({
          nutritionPlanId: feedPlan.id,
          petId: otherPet.id,
          ingredients: 'Chicken',
          userAddress: testPet.owner,
          petSignature: 'sig'
        })
        .expect(400);

      expect(res.body.error).toContain('not linked to this pet');
    });

    test('should record a feeding action successfully', async () => {
      const res = await request(app)
        .post('/api/v1/petdiet/feed')
        .send({
          nutritionPlanId: feedPlan.id,
          petId: testPet.id,
          ingredients: 'Chicken, Rice',
          userAddress: testPet.owner,
          petSignature: 'mock_pet_signature_123'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.onChain.transactionSignature).toBeDefined();
      expect(res.body.metadata.solscanUrl).toContain('solscan.io');
    });
  });
});
