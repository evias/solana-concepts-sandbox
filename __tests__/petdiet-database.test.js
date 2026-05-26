/**
 * PetDiet Database Tests
 * Tests for nutrition plans and feeding actions database operations
 */

const { 
  db, 
  petDb, 
  nutritionPlanDb, 
  feedingActionDb, 
  initializeDatabase, 
  runMigrations 
} = require('../api/database');
const path = require('path');
const fs = require('fs');

describe('PetDiet Database Operations', () => {
  // Test setup - ensure database exists
  beforeAll(() => {
    // Database should already be initialized from other test runs
    if (fs.existsSync(path.join(__dirname, '..', 'pettracker.db'))) {
      // Database exists, migrations should have been run
    }
  });

  // Helper function to create a test pet
  const createTestPet = () => {
    const petId = `pet_${Date.now()}_${Math.random()}`;
    const pet = petDb.createPet({
      id: petId,
      name: 'Test Pet',
      species: 'Dog',
      breed: 'Labrador',
      age: 3,
      owner: 'test_owner_' + Date.now(),
      mandateAuthority: 'test_authority_' + Date.now()
    });
    return pet;
  };

  // Nutrition Plan Tests
  describe('Nutrition Plan Database', () => {
    test('should create a nutrition plan', () => {
      const pet = createTestPet();
      const planId = `diet_${Date.now()}`;

      const plan = nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Summer Wellness Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken, Rice',
        ingredientsTuesday: 'Beef, Vegetables',
        ingredientsWednesday: 'Fish, Sweet Potato',
        ingredientsThursday: 'Chicken, Brown Rice',
        ingredientsFriday: 'Turkey, Oats',
        ingredientsSaturday: 'Lamb, Barley',
        ingredientsSunday: 'Chicken, Pasta',
        duration: '1 month',
        durationEndDate: '2024-06-26',
        authorizedNutritioner: null,
        mintAddress: 'test_mint_address',
        transactionSignature: 'test_sig',
        transactionHash: 'test_hash'
      });

      expect(plan).toBeDefined();
      expect(plan.id).toBe(planId);
      expect(plan.plan_name).toBe('Summer Wellness Plan');
      expect(plan.pet_id).toBe(pet.id);
      expect(plan.duration).toBe('1 month');
    });

    test('should get nutrition plan by ID', () => {
      const pet = createTestPet();
      const planId = `diet_${Date.now()}`;

      nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Test Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '2 weeks',
        durationEndDate: '2024-06-09',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'test_sig',
        transactionHash: 'test_hash'
      });

      const retrieved = nutritionPlanDb.getNutritionPlanById(planId);
      expect(retrieved).toBeDefined();
      expect(retrieved.plan_name).toBe('Test Plan');
    });

    test('should get nutrition plans by pet ID', () => {
      const pet = createTestPet();
      const planId1 = `diet_${Date.now()}_1`;
      const planId2 = `diet_${Date.now()}_2`;

      nutritionPlanDb.createNutritionPlan({
        id: planId1,
        petId: pet.id,
        planName: 'Plan 1',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '2 weeks',
        durationEndDate: '2024-06-09',
        authorizedNutritioner: null,
        mintAddress: 'test_mint1',
        transactionSignature: 'sig1',
        transactionHash: 'hash1'
      });

      nutritionPlanDb.createNutritionPlan({
        id: planId2,
        petId: pet.id,
        planName: 'Plan 2',
        startDate: '2024-06-09',
        ingredientsMonday: 'Beef',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2024-07-09',
        authorizedNutritioner: null,
        mintAddress: 'test_mint2',
        transactionSignature: 'sig2',
        transactionHash: 'hash2'
      });

      const plans = nutritionPlanDb.getNutritionPlansByPetId(pet.id);
      expect(plans).toBeDefined();
      expect(plans.length).toBeGreaterThanOrEqual(2);
      
      const planIds = plans.map(p => p.id);
      expect(planIds).toContain(planId1);
      expect(planIds).toContain(planId2);
    });

    test('should get nutrition plans by authorized nutritioner', () => {
      const pet = createTestPet();
      const nutritioner = 'nutritioner_' + Date.now();
      const planId = `diet_${Date.now()}`;

      nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Nutritionist Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Specialized',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 month',
        durationEndDate: '2024-06-26',
        authorizedNutritioner: nutritioner,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      const plans = nutritionPlanDb.getNutritionPlansByNutritioner(nutritioner);
      expect(plans).toBeDefined();
      expect(plans.length).toBeGreaterThanOrEqual(1);
      expect(plans[0].authorized_nutritioner).toBe(nutritioner);
    });

    test('should get ingredients for specific day', () => {
      const pet = createTestPet();
      const planId = `diet_${Date.now()}`;

      const plan = nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Weekly Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken, Rice',
        ingredientsTuesday: 'Beef, Vegetables',
        ingredientsWednesday: 'Fish, Sweet Potato',
        ingredientsThursday: 'Chicken, Brown Rice',
        ingredientsFriday: 'Turkey, Oats',
        ingredientsSaturday: 'Lamb, Barley',
        ingredientsSunday: 'Mixed Vegetables',
        duration: '1 week',
        durationEndDate: '2024-06-02',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      // Test Monday (0)
      const mondayIngredients = nutritionPlanDb.getIngredientsForDay(planId, 0);
      expect(mondayIngredients).toBe('Chicken, Rice');

      // Test Friday (4)
      const fridayIngredients = nutritionPlanDb.getIngredientsForDay(planId, 4);
      expect(fridayIngredients).toBe('Turkey, Oats');

      // Test Sunday (6)
      const sundayIngredients = nutritionPlanDb.getIngredientsForDay(planId, 6);
      expect(sundayIngredients).toBe('Mixed Vegetables');
    });

    test('should get all ingredients for a plan', () => {
      const pet = createTestPet();
      const planId = `diet_${Date.now()}`;

      nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Full Week Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Mon Ingredients',
        ingredientsTuesday: 'Tue Ingredients',
        ingredientsWednesday: 'Wed Ingredients',
        ingredientsThursday: 'Thu Ingredients',
        ingredientsFriday: 'Fri Ingredients',
        ingredientsSaturday: 'Sat Ingredients',
        ingredientsSunday: 'Sun Ingredients',
        duration: '1 week',
        durationEndDate: '2024-06-02',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      const allIngredients = nutritionPlanDb.getAllIngredients(planId);
      expect(allIngredients).toBeDefined();
      expect(allIngredients.length).toBe(7);
      expect(allIngredients[0]).toBe('Mon Ingredients');
      expect(allIngredients[6]).toBe('Sun Ingredients');
    });
  });

  // Feeding Action Tests
  describe('Feeding Action Database', () => {
    test('should create a feeding action', () => {
      const pet = createTestPet();
      const planId = `diet_${Date.now()}`;

      const plan = nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Test Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 week',
        durationEndDate: '2024-06-02',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      const actionId = `action_${Date.now()}`;
      const action = feedingActionDb.createFeedingAction({
        id: actionId,
        nutritionPlanId: planId,
        petId: pet.id,
        ingredients: 'Chicken, Rice',
        petSignature: 'sig_pet_123',
        transactionSignature: 'tx_sig',
        transactionHash: 'tx_hash'
      });

      expect(action).toBeDefined();
      expect(action.id).toBe(actionId);
      expect(action.nutrition_plan_id).toBe(planId);
      expect(action.ingredients).toBe('Chicken, Rice');
    });

    test('should get feeding action by ID', () => {
      const pet = createTestPet();
      const planId = `diet_${Date.now()}`;

      nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Test Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 week',
        durationEndDate: '2024-06-02',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      const actionId = `action_${Date.now()}`;
      feedingActionDb.createFeedingAction({
        id: actionId,
        nutritionPlanId: planId,
        petId: pet.id,
        ingredients: 'Beef, Vegetables',
        petSignature: 'pet_sig',
        transactionSignature: 'tx_sig',
        transactionHash: 'tx_hash'
      });

      const retrieved = feedingActionDb.getFeedingActionById(actionId);
      expect(retrieved).toBeDefined();
      expect(retrieved.ingredients).toBe('Beef, Vegetables');
    });

    test('should get feeding actions by plan ID', () => {
      const pet = createTestPet();
      const planId = `diet_${Date.now()}`;

      nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Test Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 week',
        durationEndDate: '2024-06-02',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      const action1 = `action_${Date.now()}_1`;
      const action2 = `action_${Date.now()}_2`;

      feedingActionDb.createFeedingAction({
        id: action1,
        nutritionPlanId: planId,
        petId: pet.id,
        ingredients: 'Chicken, Rice',
        petSignature: 'sig1',
        transactionSignature: 'tx1',
        transactionHash: 'hash1'
      });

      feedingActionDb.createFeedingAction({
        id: action2,
        nutritionPlanId: planId,
        petId: pet.id,
        ingredients: 'Beef, Vegetables',
        petSignature: 'sig2',
        transactionSignature: 'tx2',
        transactionHash: 'hash2'
      });

      const actions = feedingActionDb.getFeedingActionsByPlanId(planId);
      expect(actions).toBeDefined();
      expect(actions.length).toBeGreaterThanOrEqual(2);
      
      const actionIds = actions.map(a => a.id);
      expect(actionIds).toContain(action1);
      expect(actionIds).toContain(action2);
    });

    test('should get feeding actions by pet ID', () => {
      const pet = createTestPet();
      const planId = `diet_${Date.now()}`;

      nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Test Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 week',
        durationEndDate: '2024-06-02',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      const actionId = `action_${Date.now()}`;
      feedingActionDb.createFeedingAction({
        id: actionId,
        nutritionPlanId: planId,
        petId: pet.id,
        ingredients: 'Turkey, Oats',
        petSignature: 'pet_sig',
        transactionSignature: 'tx_sig',
        transactionHash: 'tx_hash'
      });

      const actions = feedingActionDb.getFeedingActionsByPetId(pet.id);
      expect(actions).toBeDefined();
      expect(actions.length).toBeGreaterThanOrEqual(1);
      expect(actions[0].pet_id).toBe(pet.id);
    });

    test('should get feeding action by transaction hash', () => {
      const pet = createTestPet();
      const planId = `diet_${Date.now()}`;

      nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet.id,
        planName: 'Test Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 week',
        durationEndDate: '2024-06-02',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      const txHash = `unique_hash_${Date.now()}`;
      const actionId = `action_${Date.now()}`;

      feedingActionDb.createFeedingAction({
        id: actionId,
        nutritionPlanId: planId,
        petId: pet.id,
        ingredients: 'Fish, Vegetables',
        petSignature: 'pet_sig',
        transactionSignature: 'tx_sig',
        transactionHash: txHash
      });

      const retrieved = feedingActionDb.getFeedingActionByTransactionHash(txHash);
      expect(retrieved).toBeDefined();
      expect(retrieved.transaction_hash).toBe(txHash);
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    test('should throw error when creating plan with non-existent pet', () => {
      expect(() => {
        nutritionPlanDb.createNutritionPlan({
          id: `diet_${Date.now()}`,
          petId: 'non_existent_pet_id',
          planName: 'Bad Plan',
          startDate: '2024-05-26',
          ingredientsMonday: 'Chicken',
          ingredientsTuesday: '',
          ingredientsWednesday: '',
          ingredientsThursday: '',
          ingredientsFriday: '',
          ingredientsSaturday: '',
          ingredientsSunday: '',
          duration: '1 week',
          durationEndDate: '2024-06-02',
          authorizedNutritioner: null,
          mintAddress: 'test_mint',
          transactionSignature: 'sig',
          transactionHash: 'hash'
        });
      }).toThrow('Pet not found');
    });

    test('should throw error when creating feeding action with non-existent plan', () => {
      const pet = createTestPet();

      expect(() => {
        feedingActionDb.createFeedingAction({
          id: `action_${Date.now()}`,
          nutritionPlanId: 'non_existent_plan_id',
          petId: pet.id,
          ingredients: 'Chicken',
          petSignature: 'sig',
          transactionSignature: 'tx_sig',
          transactionHash: 'tx_hash'
        });
      }).toThrow('Nutrition plan not found');
    });

    test('should throw error when creating feeding action for mismatched pet', () => {
      const pet1 = createTestPet();
      const pet2 = createTestPet();
      const planId = `diet_${Date.now()}`;

      nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: pet1.id,
        planName: 'Test Plan',
        startDate: '2024-05-26',
        ingredientsMonday: 'Chicken',
        ingredientsTuesday: '',
        ingredientsWednesday: '',
        ingredientsThursday: '',
        ingredientsFriday: '',
        ingredientsSaturday: '',
        ingredientsSunday: '',
        duration: '1 week',
        durationEndDate: '2024-06-02',
        authorizedNutritioner: null,
        mintAddress: 'test_mint',
        transactionSignature: 'sig',
        transactionHash: 'hash'
      });

      expect(() => {
        feedingActionDb.createFeedingAction({
          id: `action_${Date.now()}`,
          nutritionPlanId: planId,
          petId: pet2.id,
          ingredients: 'Chicken',
          petSignature: 'sig',
          transactionSignature: 'tx_sig',
          transactionHash: 'tx_hash'
        });
      }).toThrow('not linked to pet');
    });
  });
});
