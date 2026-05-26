const express = require('express');
const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { petDb, nutritionPlanDb, feedingActionDb, db } = require('./database');
const { payer } = require('./payer');

// Solana connection
const connection = new web3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

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

// POST /api/v1/petdiet/create-plan - Create a new nutrition plan with SPL token minting
router.post('/create-plan', express.json(), async (req, res) => {
  try {
    const { 
      petId, 
      planName, 
      startDate, 
      ingredientsMonday,
      ingredientsTuesday,
      ingredientsWednesday,
      ingredientsThursday,
      ingredientsFriday,
      ingredientsSaturday,
      ingredientsSunday,
      duration,
      durationEndDate,
      authorizedNutritioner,
      ownerAddress
    } = req.body;
    
    // Validate required fields
    if (!petId || !planName || !startDate || !duration || !durationEndDate || !ownerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate that at least one day of ingredients is filled
    const ingredientsArray = [
      ingredientsMonday,
      ingredientsTuesday,
      ingredientsWednesday,
      ingredientsThursday,
      ingredientsFriday,
      ingredientsSaturday,
      ingredientsSunday
    ];

    if (ingredientsArray.every(ing => !ing || !ing.trim())) {
      return res.status(400).json({ error: 'At least one day of ingredients must be provided' });
    }

    // Validate Solana addresses
    try {
      new web3.PublicKey(ownerAddress);
      if (authorizedNutritioner) {
        new web3.PublicKey(authorizedNutritioner);
      }
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Solana address format' });
    }

    // Verify pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    // Verify owner authorization
    if (pet.owner !== ownerAddress) {
      return res.status(403).json({ error: 'Only pet owner can create nutrition plans' });
    }

    console.log(`[PetDiet] Creating nutrition plan for pet ${petId}...`);

    // Create SPL token mint for this nutrition plan
    console.log(`[PetDiet] Creating SPL token mint...`);
    const mint = await splToken.createMint(
      connection,
      payer,
      payer.publicKey,      // Mint authority
      payer.publicKey,      // Freeze authority
      0                     // Decimals
    );

    const mintAddress = mint.toBase58();
    console.log(`[PetDiet] Token mint created:`, mintAddress);

    // Create associated token account for the owner
    console.log(`[PetDiet] Creating associated token account...`);
    const ownerPublicKey = new web3.PublicKey(ownerAddress);
    const associatedTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      ownerPublicKey
    );

    const tokenAccount = associatedTokenAccount.address.toBase58();
    console.log(`[PetDiet] Token account created:`, tokenAccount);

    // Mint 1 token to represent this nutrition plan
    console.log(`[PetDiet] Minting nutrition plan token...`);
    const signature = await splToken.mintTo(
      connection,
      payer,
      mint,
      associatedTokenAccount.address,
      payer,
      1
    );

    console.log(`[PetDiet] Token minted, signature:`, signature);

    // Create nutrition plan record in database
    const planId = 'diet_' + Date.now();

    try {
      // Auto-fill empty ingredient days with the last filled day's ingredients
      let lastFilledIngredients = '';
      const filledIngredients = [
        ingredientsMonday || null,
        ingredientsTuesday || null,
        ingredientsWednesday || null,
        ingredientsThursday || null,
        ingredientsFriday || null,
        ingredientsSaturday || null,
        ingredientsSunday || null
      ];

      for (let i = filledIngredients.length - 1; i >= 0; i--) {
        if (filledIngredients[i]) {
          lastFilledIngredients = filledIngredients[i];
          break;
        }
      }

      const plan = nutritionPlanDb.createNutritionPlan({
        id: planId,
        petId: petId,
        planName: planName,
        startDate: startDate,
        ingredientsMonday: ingredientsMonday || lastFilledIngredients,
        ingredientsTuesday: ingredientsTuesday || lastFilledIngredients,
        ingredientsWednesday: ingredientsWednesday || lastFilledIngredients,
        ingredientsThursday: ingredientsThursday || lastFilledIngredients,
        ingredientsFriday: ingredientsFriday || lastFilledIngredients,
        ingredientsSaturday: ingredientsSaturday || lastFilledIngredients,
        ingredientsSunday: ingredientsSunday || lastFilledIngredients,
        duration: duration,
        durationEndDate: durationEndDate,
        authorizedNutritioner: authorizedNutritioner || null,
        mintAddress: mintAddress,
        transactionSignature: signature,
        transactionHash: signature
      });

      console.log(`[PetDiet] Nutrition plan created:`, planId);

      res.json({
        success: true,
        plan: plan,
        message: 'Nutrition plan created with SPL token',
        onChain: {
          mint: mintAddress,
          tokenAccount: tokenAccount,
          transactionSignature: signature
        },
        metadata: {
          petId: pet.id,
          petName: pet.name,
          planName: planName,
          onChainProof: true,
          transactionSignature: signature,
          transactionHash: signature,
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
    console.error('[PetDiet] Error creating nutrition plan:', error);
    res.status(500).json({ error: `Failed to create nutrition plan: ${error.message}` });
  }
});

// POST /api/v1/petdiet/feed - Record a feeding action
router.post('/feed', express.json(), async (req, res) => {
  try {
    const { 
      nutritionPlanId,
      petId,
      ingredients,
      userAddress,
      petSignature
    } = req.body;

    if (!nutritionPlanId || !petId || !ingredients || !userAddress || !petSignature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate Solana addresses
    try {
      new web3.PublicKey(userAddress);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Solana address format' });
    }

    // Verify nutrition plan exists
    const plan = nutritionPlanDb.getNutritionPlanById(nutritionPlanId);
    if (!plan) {
      return res.status(404).json({ error: 'Nutrition plan not found' });
    }

    // Verify pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    // Verify plan is linked to pet
    if (plan.pet_id !== petId) {
      return res.status(400).json({ error: 'Nutrition plan is not linked to this pet' });
    }

    console.log(`[PetDiet] Recording feeding action for plan ${nutritionPlanId}...`);

    // Create memo transaction for feeding action
    console.log(`[PetDiet] Creating memo transaction...`);
    
    const MEMO_PROGRAM_ID = new web3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const transaction = new web3.Transaction();

    // Create memo data with feeding information
    const memoData = JSON.stringify({
      type: 'feeding_action',
      nutritionPlanId: nutritionPlanId,
      petId: petId,
      petName: pet.name,
      ingredients: ingredients,
      petSignature: petSignature,
      recordedBy: userAddress,
      recordedAt: new Date().toISOString()
    });

    console.log('[PetDiet] Memo data:', memoData);

    // Create memo instruction
    const memoInstruction = new web3.TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(memoData, 'utf8')
    });
    transaction.add(memoInstruction);

    // Set transaction properties
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = new web3.PublicKey(userAddress);

    console.log('[PetDiet] Transaction prepared for signing');

    // Sign transaction with payer
    transaction.sign(payer);
    const signature = transaction.signature?.toString() || Buffer.from(transaction.signatures[0].signature || '').toString('hex');

    // Send transaction
    console.log(`[PetDiet] Sending transaction...`);
    const txSignature = await connection.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');
    console.log(`[PetDiet] Transaction confirmed:`, txSignature);

    // Create feeding action record
    const feedingActionId = 'action_' + Date.now();

    try {
      const feedingAction = feedingActionDb.createFeedingAction({
        id: feedingActionId,
        nutritionPlanId: nutritionPlanId,
        petId: petId,
        ingredients: ingredients,
        petSignature: petSignature,
        transactionSignature: txSignature,
        transactionHash: txSignature
      });

      console.log(`[PetDiet] Feeding action recorded:`, feedingActionId);

      res.json({
        success: true,
        feedingAction: feedingAction,
        message: 'Feeding action recorded on-chain',
        onChain: {
          transactionSignature: txSignature
        },
        metadata: {
          petId: pet.id,
          petName: pet.name,
          planId: nutritionPlanId,
          transactionHash: txSignature,
          solscanUrl: `https://solscan.io/tx/${txSignature}?cluster=devnet`
        }
      });
    } catch (error) {
      if (error.message.includes('Nutrition plan not found')) {
        return res.status(404).json({ error: 'Nutrition plan not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('[PetDiet] Error recording feeding action:', error);
    res.status(500).json({ error: `Failed to record feeding action: ${error.message}` });
  }
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
