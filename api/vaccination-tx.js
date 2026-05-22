const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const { payer } = require('./payer');

const connection = new web3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

// Memo program address
const MEMO_PROGRAM_ID = new web3.PublicKey('MemoSq4gDiYM2piU8gLgcsVCoJUn5Z5cp4TF3KT6RkN');

/**
 * Create and sign a vaccination record transaction
 * Uses memo instruction to record vaccination data on-chain
 * 
 * @param {Object} data - Vaccination data
 * @param {string} data.petId - Pet ID
 * @param {string} data.petOwner - Pet owner's Solana address
 * @param {string} data.vaccineName - Vaccine name
 * @param {string} data.vaccinationDate - Vaccination date
 * @param {string} data.vetAddress - Vet address (signer)
 * @param {object} data.signerKeypair - Keypair or Phantom provider (for signing)
 * @returns {Promise<{signature: string, petId: string, vaccineName: string, vetAddress: string}>}
 */
async function createVaccinationTransaction(data) {
  try {
    const {
      petId,
      petOwner,
      vaccineName,
      vaccinationDate,
      vetAddress,
      signerKeypair
    } = data;

    console.log('Creating vaccination transaction for pet:', petId);
    
    // Check if memo program exists on devnet
    const memoProgramInfo = await connection.getAccountInfo(MEMO_PROGRAM_ID);
    console.log('[MEMO-CHECK] Memo program exists on devnet:', !!memoProgramInfo);
    if (memoProgramInfo) {
      console.log('[MEMO-CHECK] Program executable:', memoProgramInfo.executable);
      console.log('[MEMO-CHECK] Program owner:', memoProgramInfo.owner.toString());
    } else {
      console.warn('[MEMO-CHECK] WARNING: Memo program NOT found on devnet!');
    }

    // Create a transaction with vaccination data in a memo instruction
    const transaction = new web3.Transaction();
    
    // Add memo instruction with vaccination details
    const memoData = JSON.stringify({
      type: 'vaccination_record',
      petId,
      petOwner,
      vaccineName,
      vaccinationDate,
      vetAddress,
      recordedAt: new Date().toISOString()
    });

    console.log("createVaccinationTransaction: memoData = ", memoData);

    // Create memo instruction using the SPL Memo program
    // The memo program just stores data, no accounts needed
    const memoInstruction = new web3.TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(memoData, 'utf8')
    });
    await transaction.add(memoInstruction);

    // Set transaction properties
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = new web3.PublicKey(petOwner); // Owner pays for transaction ("PAYING VACCINE")

    console.log('Transaction created with memo data');
    console.log('[TX-DEBUG] Fee payer:', transaction.feePayer.toString());
    console.log('[TX-DEBUG] Recent blockhash:', transaction.recentBlockhash);
    console.log('[TX-DEBUG] instructions count:', transaction.instructions.length);
    console.log('[TX-DEBUG] instruction[0].data length:', transaction.instructions[0].data.length);
    console.log('[TX-DEBUG] instruction[0].data:', transaction.instructions[0].data.toString('utf8').substring(0, 100) + '...');

    // Note: The actual signing happens in the frontend with Phantom
    // This function prepares the transaction
    return {
      ready: true,
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      message: 'Transaction ready for signing',
      petId,
      vaccineName,
      vetAddress
    };
  } catch (error) {
    console.error('Error creating vaccination transaction:', error);
    throw error;
  }
}

/**
 * Verify a vaccination transaction signature
 * 
 * @param {string} signature - Transaction signature
 * @param {string} petId - Pet ID
 * @returns {Promise<boolean>} - Whether signature is valid
 */
async function verifyVaccinationSignature(signature, petId) {
  try {
    // Check if transaction exists on-chain
    const tx = await connection.getTransaction(signature);
    if (!tx) {
      console.log('Transaction not found on-chain:', signature);
      return false;
    }

    console.log('Transaction verified on-chain:', signature);
    return true;
  } catch (error) {
    console.error('Error verifying vaccination signature:', error);
    return false;
  }
}

/**
 * Get vaccination transaction info
 * 
 * @param {string} signature - Transaction signature
 * @returns {Promise<Object>} - Transaction details
 */
async function getVaccinationTransactionInfo(signature) {
  try {
    const tx = await connection.getTransaction(signature);
    if (!tx) {
      return null;
    }

    // Extract memo data if available
    let memoData = null;
    if (tx.transaction.message.instructions) {
      const memoInstruction = tx.transaction.message.instructions.find(
        instr => instr.programId?.toString() === 'MemoSq4gDiYM2piU8gLgcsVCoJUn5Z5cp4TF3KT6RkN'
      );
      if (memoInstruction && memoInstruction.data) {
        try {
          memoData = JSON.parse(memoInstruction.data.toString());
        } catch (e) {
          console.log('Could not parse memo data');
        }
      }
    }

    return {
      signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      status: tx.meta?.err ? 'failed' : 'success',
      memoData
    };
  } catch (error) {
    console.error('Error getting vaccination transaction info:', error);
    return null;
  }
}

module.exports = {
  createVaccinationTransaction,
  verifyVaccinationSignature,
  getVaccinationTransactionInfo
};
