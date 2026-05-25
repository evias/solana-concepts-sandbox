const lib = require('sas-lib');
const web3 = require('@solana/web3.js');

// Initialize connection
const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');

// SAS Program address on devnet
const SAS_PROGRAM_ID = lib.SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS;

/**
 * Ensure a SAS Credential exists for a pet owner
 * If it doesn't exist, create one. If it does, return existing.
 * @param {string} ownerAddress - Pet owner's Solana wallet address
 * @param {web3.Keypair} payer - Payer for transaction fees
 * @returns {Promise<object>} { credentialAddress, exists, transactionSignature?, authorizedSigners }
 */
async function ensureSasCredential(ownerAddress, payer) {
  try {
    // Derive credential PDA for this owner
    // Each owner gets one credential "pet-owner"
    const credentialPda = await lib.deriveCredentialPda({
      authority: ownerAddress,
      name: 'pet-owner'
    });

    const credentialAddress = credentialPda[0].toString();

    // Try to fetch existing credential
    const existingCredential = await lib.fetchMaybeCredential(connection, credentialAddress);

    if (existingCredential) {
      // Credential already exists
      return {
        credentialAddress,
        exists: true,
        transactionSignature: null,
        authorizedSigners: existingCredential.authorizedSigners || []
      };
    }

    // Credential doesn't exist - create it
    const createCredentialIx = lib.getCreateCredentialInstruction({
      authority: ownerAddress,
      name: 'pet-owner',
      payer: payer.publicKey.toString()
    });

    // Create transaction
    const tx = new web3.Transaction();
    tx.add(createCredentialIx);

    // Sign and send
    const txSig = await web3.sendAndConfirmTransaction(connection, tx, [payer], {
      skipPreflight: false
    });

    return {
      credentialAddress,
      exists: false,
      transactionSignature: txSig,
      authorizedSigners: []
    };
  } catch (error) {
    console.error('Error ensuring SAS credential:', error);
    throw new Error(`Failed to ensure SAS credential: ${error.message}`);
  }
}

/**
 * Add an authorized signer to an existing credential
 * @param {string} credentialAddress - The credential address
 * @param {string} ownerAddress - The credential owner/authority
 * @param {string} newSignerAddress - The signer address to add
 * @param {web3.Keypair} payer - Payer for transaction fees
 * @returns {Promise<object>} { transactionSignature, authorizedSigners }
 */
async function addAuthorizedSigner(credentialAddress, ownerAddress, newSignerAddress, payer) {
  try {
    // Fetch current credential
    const credential = await lib.fetchMaybeCredential(connection, credentialAddress);

    if (!credential) {
      throw new Error('Credential does not exist');
    }

    // Check if signer already in list
    const currentSigners = credential.authorizedSigners || [];
    if (currentSigners.includes(newSignerAddress)) {
      throw new Error('Signer already authorized for this credential');
    }

    // Create new signers array
    const updatedSigners = [...currentSigners, newSignerAddress];

    // Get instruction to update signers
    const changeSignersIx = lib.getChangeAuthorizedSignersInstruction({
      authority: ownerAddress,
      name: 'pet-owner',
      newAuthorities: updatedSigners,
      payer: payer.publicKey.toString()
    });

    // Create and send transaction
    const tx = new web3.Transaction();
    tx.add(changeSignersIx);

    const txSig = await web3.sendAndConfirmTransaction(connection, tx, [payer], {
      skipPreflight: false
    });

    return {
      transactionSignature: txSig,
      authorizedSigners: updatedSigners
    };
  } catch (error) {
    console.error('Error adding authorized signer:', error);
    throw new Error(`Failed to add authorized signer: ${error.message}`);
  }
}

/**
 * Get the current list of authorized signers for a credential
 * @param {string} credentialAddress - The credential address
 * @returns {Promise<array>} Array of signer addresses, or empty array if credential doesn't exist
 */
async function getAuthorizedSigners(credentialAddress) {
  try {
    const credential = await lib.fetchMaybeCredential(connection, credentialAddress);
    if (!credential) {
      return [];
    }
    return credential.authorizedSigners || [];
  } catch (error) {
    console.error('Error fetching authorized signers:', error);
    return [];
  }
}

module.exports = {
  ensureSasCredential,
  addAuthorizedSigner,
  getAuthorizedSigners
};
