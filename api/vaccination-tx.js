const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const { payer } = require('./payer');
const { createLogger } = require('./logger');
const log = createLogger('vaccination-tx');

const connection = new web3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

// Memo program address
const MEMO_PROGRAM_ID = new web3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Create and sign a vaccination record transaction
 * Uses memo instruction to record vaccination data on-chain
 * 
 * @param {Object} data - Vaccination data
 * @param {string} data.petId - Pet ID
 * @param {string} data.petName - Pet name
 * @param {string} data.petOwner - Pet owner's Solana address
 * @param {string} data.vaccineName - Vaccine name
 * @param {string} data.vaccinationDate - Vaccination date
 * @param {string} data.vetAddress - Vet address (signer)
 * @param {boolean} data.mustRenew - Must renew flag
 * @param {string} data.renewalPeriod - Renewal period
 * @param {string} data.customRenewalPeriod - Custom renewal period
 * @param {string} data.vaccinationToken - Vaccination token mint address
 * @param {string} data.vaccineUrl - Vaccine URL (optional)
 * @param {string} data.clinicUrl - Clinic URL (optional)
 * @param {string} data.petSignature - Pet message signature
 * @param {object} data.signerKeypair - Keypair or Phantom provider (for signing)
 * @returns {Promise<{signature: string, petId: string, vaccineName: string, vetAddress: string}>}
 */
async function createVaccinationTransaction(data) {
  try {
    const {
      petId,
      petName,
      petOwner,
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
      signerKeypair
    } = data;

    log.info('Creating vaccination transaction for pet:', { value: petId });
    
    // Check if memo program exists on devnet
    const memoProgramInfo = await connection.getAccountInfo(MEMO_PROGRAM_ID);
    log.info('[MEMO-CHECK] Memo program exists on devnet:', { value: !!memoProgramInfo });
    if (memoProgramInfo) {
      log.info('[MEMO-CHECK] Program executable:', { value: memoProgramInfo.executable });
      log.info('[MEMO-CHECK] Program owner:', { value: memoProgramInfo.owner.toString() });
    } else {
      log.warn('[MEMO-CHECK] WARNING: Memo program NOT found on devnet!');
    }

    // Create a transaction with vaccination data in a memo instruction
    const transaction = new web3.Transaction();
    
    // Add memo instruction with vaccination details
    const memoData = JSON.stringify({
      type: 'vaccination_renewal_record',
      petId,
      petName,
      petOwner,
      vaccineName,
      vaccinationDate,
      vetAddress,
      mustRenew,
      renewalPeriod,
      customRenewalPeriod: renewalPeriod === 'custom' ? customRenewalPeriod : null,
      vaccinationToken,
      vaccineUrl: vaccineUrl || null,
      clinicUrl: clinicUrl || null,
      petSignature,
      recordedAt: new Date().toISOString()
     });

     log.debug("createVaccinationTransaction: memoData", { memoData });

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

    log.info('Transaction created with memo data');
    log.info('[TX-DEBUG] Fee payer:', { value: transaction.feePayer.toString() });
    log.info('[TX-DEBUG] Recent blockhash:', { value: transaction.recentBlockhash });
    log.info('[TX-DEBUG] instructions count:', { value: transaction.instructions.length });
    log.info('[TX-DEBUG] instruction[0].data length:', { value: transaction.instructions[0].data.length });
    log.info('[TX-DEBUG] instruction[0].data:', { value: transaction.instructions[0].data.toString('utf8').substring(0, 100) + '...' });

    // Note: The actual signing happens in the frontend with Phantom
    // This function prepares the transaction
    return {
      ready: true,
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      message: 'Transaction ready for signing',
      petId,
      petName,
      vaccineName,
      vetAddress
    };
  } catch (error) {
    log.error('Error creating vaccination transaction:', { error: error });
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
      log.info('Transaction not found on-chain:', { value: signature });
      return false;
    }

    log.info('Transaction verified on-chain:', { value: signature });
    return true;
  } catch (error) {
    log.error('Error verifying vaccination signature:', { error: error });
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
        instr => instr.programId?.toString() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
      );
      if (memoInstruction && memoInstruction.data) {
        try {
          memoData = JSON.parse(memoInstruction.data.toString());
        } catch (e) {
          log.info('Could not parse memo data');
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
    log.error('Error getting vaccination transaction info:', { error: error });
    return null;
  }
}

module.exports = {
  createVaccinationTransaction,
  verifyVaccinationSignature,
  getVaccinationTransactionInfo
};
