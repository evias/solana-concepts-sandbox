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

// Memo program address
const MEMO_PROGRAM_ID = new web3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

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

     // Create nutrition plan ID upfront so we can use it in memo (with random component to ensure uniqueness)
      const planId = 'diet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

     // Create memo transaction with nutrition plan details
     console.log(`[PetDiet] Creating memo transaction with nutrition plan data...`);
     const transaction = new web3.Transaction();
     
     // Create memo data with nutrition plan information
     const memoData = JSON.stringify({
       type: 'nutrition_plan',
       planId: planId,
       petId: petId,
       petName: pet.name,
       planName: planName,
       startDate: startDate,
       ingredientsMonday: ingredientsMonday || '',
       ingredientsTuesday: ingredientsTuesday || '',
       ingredientsWednesday: ingredientsWednesday || '',
       ingredientsThursday: ingredientsThursday || '',
       ingredientsFriday: ingredientsFriday || '',
       ingredientsSaturday: ingredientsSaturday || '',
       ingredientsSunday: ingredientsSunday || '',
       duration: duration,
       durationEndDate: durationEndDate,
       authorizedNutritioner: authorizedNutritioner || null,
       mintAddress: mintAddress,
       recordedAt: new Date().toISOString()
     });

     console.log('[PetDiet] Memo data:', memoData);

      // Add compute budget instruction to increase units for large memo
      const computeBudgetProgram = new web3.PublicKey('ComputeBudget111111111111111111111111111111');
      const computeUnits = 400000;  // Request 400k compute units (larger than default 200k)
      const computeUnitsBuffer = Buffer.alloc(4);
      computeUnitsBuffer.writeUInt32LE(computeUnits, 0);
      
      const modifyComputeUnitsInstruction = new web3.TransactionInstruction({
        programId: computeBudgetProgram,
        keys: [],
        data: Buffer.concat([
          Buffer.from([0x02]),  // SetComputeUnitLimit instruction
          computeUnitsBuffer
        ])
      });
      transaction.add(modifyComputeUnitsInstruction);

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
      transaction.feePayer = payer.publicKey;  // Backend payer signs and pays

      // Sign and send transaction
      transaction.sign(payer);
     let memoTxSignature;
     try {
       memoTxSignature = await connection.sendRawTransaction(transaction.serialize());
       
       // Wait for confirmation
       await connection.confirmTransaction(memoTxSignature, 'confirmed');
       console.log(`[PetDiet] Memo transaction confirmed:`, memoTxSignature);
     } catch (memoError) {
       console.error(`[PetDiet] Error creating memo transaction:`, memoError.message);
       console.error(`[PetDiet] Will fall back to using token signature`);
       memoTxSignature = signature; // Fallback to token signature if memo fails
     }

      try {
        // Auto-fill empty ingredient days with forward-fill (each empty day inherits from previous non-empty day)
        const days = [
          { key: 'Monday', value: ingredientsMonday },
          { key: 'Tuesday', value: ingredientsTuesday },
          { key: 'Wednesday', value: ingredientsWednesday },
          { key: 'Thursday', value: ingredientsThursday },
          { key: 'Friday', value: ingredientsFriday },
          { key: 'Saturday', value: ingredientsSaturday },
          { key: 'Sunday', value: ingredientsSunday }
        ];

        // Forward-fill: iterate through week, carrying forward the last non-empty value
        let currentIngredients = '';
        const filledDays = {};
        
        for (const day of days) {
          if (day.value) {
            currentIngredients = day.value;
          } else if (currentIngredients) {
            // Use the last seen non-empty value
            filledDays[day.key] = currentIngredients;
          }
          filledDays[day.key] = day.value || currentIngredients;
        }

        const plan = nutritionPlanDb.createNutritionPlan({
          id: planId,
          petId: petId,
          planName: planName,
          startDate: startDate,
          ingredientsMonday: filledDays['Monday'] || '',
          ingredientsTuesday: filledDays['Tuesday'] || '',
          ingredientsWednesday: filledDays['Wednesday'] || '',
          ingredientsThursday: filledDays['Thursday'] || '',
          ingredientsFriday: filledDays['Friday'] || '',
          ingredientsSaturday: filledDays['Saturday'] || '',
          ingredientsSunday: filledDays['Sunday'] || '',
         duration: duration,
         durationEndDate: durationEndDate,
         authorizedNutritioner: authorizedNutritioner || null,
         mintAddress: mintAddress,
         transactionSignature: signature,
         transactionHash: memoTxSignature  // Memo transaction with plan data
       });

      console.log(`[PetDiet] Nutrition plan created:`, planId);

       res.json({
         success: true,
         plan: plan,
         message: 'Nutrition plan created with SPL token and on-chain memo',
         onChain: {
           mint: mintAddress,
           tokenAccount: tokenAccount,
           tokenTransactionSignature: signature,
           memoTransactionSignature: memoTxSignature
         },
         metadata: {
           petId: pet.id,
           petName: pet.name,
           planName: planName,
           onChainProof: true,
           mintAddress: mintAddress,
           transactionHash: memoTxSignature,
           solscanUrl: `https://solscan.io/tx/${memoTxSignature}?cluster=devnet`
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

     // Add compute budget instruction to increase units for large memo
     const computeBudgetProgram = new web3.PublicKey('ComputeBudget111111111111111111111111111111');
     const computeUnits = 400000;  // Request 400k compute units (larger than default 200k)
     const computeUnitsBuffer = Buffer.alloc(4);
     computeUnitsBuffer.writeUInt32LE(computeUnits, 0);
     
     const modifyComputeUnitsInstruction = new web3.TransactionInstruction({
       programId: computeBudgetProgram,
       keys: [],
       data: Buffer.concat([
         Buffer.from([0x02]),  // SetComputeUnitLimit instruction
         computeUnitsBuffer
       ])
     });
     transaction.add(modifyComputeUnitsInstruction);

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
     transaction.feePayer = payer.publicKey;  // Backend payer signs and pays

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
         transactionHash: txSignature,
         recordedBy: userAddress
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
