const lib = require('sas-lib');
const {
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc
} = require('@solana/kit');
const web3 = require('@solana/web3.js');

// Initialize RPC
const rpc = createSolanaRpc('https://api.devnet.solana.com');

/**
 * Convert role number to web3 account metadata
 * role: 0=readonly, 1=writable, 2=signer+readonly, 3=signer+writable
 */
function roleToWeb3Account(address, role) {
  return {
    pubkey: new web3.PublicKey(address),
    isSigner: role >= 2,
    isWritable: role === 1 || role === 3
  };
}

/**
 * Convert @solana/kit instruction to web3.js instruction
 */
async function kitInstructionToWeb3(kitIx) {
  return new web3.TransactionInstruction({
    keys: kitIx.accounts.map(acc => roleToWeb3Account(acc.address, acc.role)),
    programId: new web3.PublicKey(kitIx.programAddress),
    data: Buffer.from(kitIx.data)
  });
}

/**
 * Send transaction using web3.js
 */
async function sendTransaction(ix, payer) {
  const tx = new web3.Transaction();
  tx.add(ix);
  
  const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
  tx.feePayer = payer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  tx.sign(payer);
  
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  
  return sig;
}

/**
 * Ensure a SAS Credential exists for tracking a pet owner's vets
 * The credential is created under the PAYER (backend), not the owner
 * because the backend needs to sign for SAS operations
 * @param {string} ownerAddress - Pet owner's Solana wallet address (used as part of credential name)
 * @param {web3.Keypair} payer - Payer for transaction fees (also authority)
 * @returns {Promise<object>} { credentialAddress, exists, transactionSignature?, authorizedSigners }
 */
async function ensureSasCredential(ownerAddress, payer) {
  try {
    // Derive credential PDA using PAYER as authority (not owner)
    // This allows the backend to control the credential
    const credentialPda = await lib.deriveCredentialPda({
      authority: payer.publicKey.toBase58(),
      name: 'pet-owner'
    });

    const credentialAddress = credentialPda[0].toString();
    console.log(`[SAS] Derived credential PDA: ${credentialAddress}`);

    // Check if credential exists
    console.log(`[SAS] Fetching credential...`);
    const existingCredential = await lib.fetchMaybeCredential(rpc, credentialAddress);

    if (existingCredential?.exists !== false) {
      console.log(`[SAS] Credential exists with ${existingCredential?.authorizedSigners?.length || 0} signers`);
      return {
        credentialAddress,
        exists: true,
        transactionSignature: null,
        authorizedSigners: existingCredential?.authorizedSigners || []
      };
    }

    // Create new credential
    console.log(`[SAS] Creating new credential...`);
    
    const payerSigner = await createKeyPairSignerFromPrivateKeyBytes(
      new Uint8Array(payer.secretKey.slice(0, 32))
    );

    const createCredentialIx = lib.getCreateCredentialInstruction({
      payer: payerSigner,
      authority: payerSigner,
      credential: credentialAddress,
      name: 'pet-owner',
      signers: []
    });

    const web3Ix = await kitInstructionToWeb3(createCredentialIx);
    const txSig = await sendTransaction(web3Ix, payer);

    console.log(`[SAS] Transaction confirmed: ${txSig}`);

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
    console.log(`[SAS] Fetching credential...`);
    const credential = await lib.fetchMaybeCredential(rpc, credentialAddress);

    if (!credential?.exists) {
      throw new Error('Credential does not exist');
    }

    // Check if signer already in list
    const currentSigners = credential.authorizedSigners || [];
    if (currentSigners.includes(newSignerAddress)) {
      throw new Error('Signer already authorized for this credential');
    }

    console.log(`[SAS] Adding signer ${newSignerAddress}...`);
    const updatedSigners = [...currentSigners, newSignerAddress];

    const payerSigner = await createKeyPairSignerFromPrivateKeyBytes(
      new Uint8Array(payer.secretKey.slice(0, 32))
    );

    const changeSignersIx = lib.getChangeAuthorizedSignersInstruction({
      payer: payerSigner,
      authority: payerSigner,
      credential: credentialAddress,
      signers: updatedSigners
    });

    const web3Ix = await kitInstructionToWeb3(changeSignersIx);
    const txSig = await sendTransaction(web3Ix, payer);

    console.log(`[SAS] Transaction confirmed: ${txSig}`);

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
 */
async function getAuthorizedSigners(credentialAddress) {
  try {
    console.log(`[SAS] Fetching authorized signers for credential: ${credentialAddress}`);
    
    // Retry logic in case of timing issues with on-chain indexing
    let credential = null;
    let retries = 0;
    const maxRetries = 3;
    const retryDelayMs = 500;
    
    while (retries < maxRetries && !credential) {
      try {
        credential = await lib.fetchMaybeCredential(rpc, credentialAddress);
        console.log(`[SAS] Credential fetch result:`, credential);
        
        if (credential?.exists) {
          break;
        }
        
        if (retries < maxRetries - 1) {
          console.log(`[SAS] Credential not ready, retrying (attempt ${retries + 1}/${maxRetries - 1})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          retries++;
        } else {
          break;
        }
      } catch (fetchError) {
        console.error(`[SAS] Error fetching credential (attempt ${retries + 1}):`, fetchError.message);
        if (retries < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          retries++;
        } else {
          throw fetchError;
        }
      }
    }
    
    if (!credential?.exists) {
      console.log(`[SAS] Credential does not exist or fetch failed after ${retries} retries`);
      return [];
    }
    
    const signers = credential.authorizedSigners || [];
    console.log(`[SAS] Found ${signers.length} authorized signers:`, signers);
    return signers;
  } catch (error) {
    console.error('[SAS] Error fetching authorized signers:', error.message);
    return [];
  }
}

module.exports = {
  ensureSasCredential,
  addAuthorizedSigner,
  getAuthorizedSigners
};
