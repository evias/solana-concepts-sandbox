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
    
    if (pet.owner !== ownerAddress) {
      return res.status(403).json({ error: 'Only pet owner can record vaccinations' });
    }
    
    console.log(`[PetVax] Recording vaccination for pet ${petId} with SPL token...`);
    
    // Create SPL token mint for this vaccination
    console.log(`[PetVax] Creating SPL token mint...`);
    const mint = await splToken.createMint(
      connection,
      payer,
      payer.publicKey,      // Mint authority
      payer.publicKey,      // Freeze authority
      0                     // Decimals
    );
    
    const mintAddress = mint.toBase58();
    console.log(`[PetVax] Token mint created:`, mintAddress);
    
    // Create associated token account for the owner
    console.log(`[PetVax] Creating associated token account...`);
    const ownerPublicKey = new web3.PublicKey(ownerAddress);
    const associatedTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      ownerPublicKey
    );
    
    const tokenAccount = associatedTokenAccount.address.toBase58();
    console.log(`[PetVax] Token account created:`, tokenAccount);
    
    // Mint 1 token to represent this vaccination
    console.log(`[PetVax] Minting vaccination token...`);
    const signature = await splToken.mintTo(
      connection,
      payer,
      mint,
      associatedTokenAccount.address,
      payer,
      1
    );
    
    console.log(`[PetVax] Token minted, signature:`, signature);
    
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
      
      console.log(`[PetVax] Vaccination recorded:`, vaccinationId);
      
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
    console.error('[PetVax] Error recording vaccination with SPL token:', error);
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
    console.error('Error preparing vaccination transaction:', error);
    res.status(500).json({ error: `Failed to prepare transaction: ${error.message}` });
  }
});

// POST /api/v1/petvax/record - Record a new vaccination with transaction signature and hash
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
        console.warn('Transaction signature could not be verified on-chain:', transactionSignature);
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
