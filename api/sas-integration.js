const lib = require('sas-lib');
const {
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc
} = require('@solana/kit');
const web3 = require('@solana/web3.js');
const crypto = require('crypto');
const { createLogger } = require('./logger');
const log = createLogger('sas-integration');

// Initialize RPC
const rpc = createSolanaRpc('https://api.devnet.solana.com');

/**
 * Extract UUID from credential ID (removes prefix like 'sas_' or 'hc_')
 */
function extractCredentialUuid(credentialId) {
  if (!credentialId) return null;
  const parts = credentialId.split('_');
  return parts.length > 1 ? parts[1] : credentialId;
}

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
  let dedupl = {};
  for (acc in kitIx.accounts) {
    let acct = kitIx.accounts[acc];
    if (!(acct.address in dedupl) || dedupl[acct.address] < acct.role) {
      dedupl[acct.address] = acct.role;
    }
  }

  const involvedKeys = [];
  for (a in dedupl) {
    let r = dedupl[a];

    involvedKeys.push(roleToWeb3Account(a, r));
  }

  return new web3.TransactionInstruction({
    keys: involvedKeys,
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
async function ensureSasCredential(ownerAddress, payer, credentialId) {
  try {
    // Check if we have a stored old SAS credential address for backward compatibility
    let oldCredentialAddress = null;
    if (credentialId) {
      const { credentialDb } = require('./database');
      const allCreds = credentialDb.getAllCredentials(1000, 0);
      const cred = allCreds.find(c => extractCredentialUuid(c.sas_credential_id) === extractCredentialUuid(credentialId));
      if (cred && cred.sas_credential_address) {
        oldCredentialAddress = cred.sas_credential_address;
        log.info(`Found stored old credential address for backward compatibility: ${oldCredentialAddress}`);
      }
    }
    
    // Use credentialId in the derivation name to ensure each credential gets its own SAS credential
    // Hash the credential ID to fit within the 32-byte seed limit
    // If credentialId is not provided, fall back to 'pet-owner' for backward compatibility
    let credentialName = 'pet-owner';
    if (credentialId) {
      // Hash the credential ID to get a unique 32-byte seed
      const hash = crypto.createHash('sha256').update(credentialId).digest();
      credentialName = hash.toString('hex').substring(0, 32); // Use first 32 chars of hex (16 bytes worth)
    }
    
    // Derive credential PDA using PAYER as authority (not owner)
    // This allows the backend to control the credential
    const credentialPda = await lib.deriveCredentialPda({
      authority: payer.publicKey.toBase58(),
      name: credentialName
    });

    const credentialAddress = credentialPda[0].toString();
    log.info(`Derived credential PDA: ${credentialAddress}`);

    // Check if credential exists at new address
    log.info(`Fetching credential from new address...`);
    let existingCredential = await lib.fetchMaybeCredential(rpc, credentialAddress);

    // If not found at new address, check old address for backward compatibility
    if (!existingCredential || existingCredential?.exists === false) {
      if (oldCredentialAddress) {
        log.info(`Credential not found at new address, checking old address...`);
        existingCredential = await lib.fetchMaybeCredential(rpc, oldCredentialAddress);
        if (existingCredential?.exists !== false) {
          log.info(`Found credential at old address, returning old address for compatibility`);
          const signers = existingCredential?.data?.authorizedSigners || existingCredential?.authorizedSigners || [];
          // Note: returning old address to preserve existing signers
          return {
            credentialAddress: oldCredentialAddress,
            exists: true,
            transactionSignature: null,
            authorizedSigners: signers
          };
        }
      }
    }

    if (existingCredential?.exists !== false) {
      // Handle both test and production data structures
      const signers = existingCredential?.data?.authorizedSigners || existingCredential?.authorizedSigners || [];
      log.info(`Credential exists with ${signers.length} signers`);
      return {
        credentialAddress,
        exists: true,
        transactionSignature: null,
        authorizedSigners: signers
      };
    }

    // Create new credential
    log.info(`Creating new credential...`);
    
    const payerSigner = await createKeyPairSignerFromPrivateKeyBytes(
      new Uint8Array(payer.secretKey.slice(0, 32))
    );

     const createCredentialIx = lib.getCreateCredentialInstruction({
       payer: payerSigner,
       authority: payerSigner,
       credential: credentialAddress,
       name: credentialName,
       signers: []
     });

    const web3Ix = await kitInstructionToWeb3(createCredentialIx);
    const txSig = await sendTransaction(web3Ix, payer);

    log.info(`Transaction confirmed: ${txSig}`);

/* NOTE: DISABLED changes by smarties.
 *
    // Also create a default schema for this credential (for attestations)
    try {
      log.info(`Creating default schema for credential...`);
      const schemaName = 'Prompt Verification';
      const fieldNames = ['promptHash'];
      const schemaVersion = 0;

      const schemaPda = await lib.deriveSchemaPda({
        credential: credentialAddress,
        name: schemaName,
        version: schemaVersion
      });

      const schemaAddress = schemaPda[0].toString();

      const schemaIx = lib.getCreateSchemaInstruction({
        payer: payerSigner,
        authority: payerSigner,
        credential: credentialAddress,
        schema: schemaAddress,
        name: schemaName,
        description: '',
        layout: Buffer.from([]),
        fieldNames: fieldNames
      });

      function roleToWeb3Account(address, role) {
        return {
          pubkey: new web3.PublicKey(address),
          isSigner: role >= 2,
          isWritable: role === 1 || role === 3
        };
      }

      const schemaWeb3Ix = new web3.TransactionInstruction({
        keys: schemaIx.accounts.map(acc => roleToWeb3Account(acc.address, acc.role)),
        programId: new web3.PublicKey(schemaIx.programAddress),
        data: Buffer.from(schemaIx.data)
      });

      await sendTransaction(schemaWeb3Ix, payer);
      log.info(`Schema created: ${schemaAddress}`);
    } catch (schemaError) {
      log.warn(`Failed to create default schema (may already exist): ${schemaError.message}`);
      // Schema creation failure is not fatal - attestation might work with existing schema
    }

*/

    return {
      credentialAddress,
      exists: false,
      transactionSignature: txSig,
      authorizedSigners: []
    };
  } catch (error) {
    log.error('Error ensuring SAS credential:', { error: error });
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
    log.info(`Fetching credential...`);
    const credential = await lib.fetchMaybeCredential(rpc, credentialAddress);

    if (!credential?.exists) {
      throw new Error('Credential does not exist');
    }

    // Check if signer already in list
    // Handle both real sas-lib format (credential.data.authorizedSigners) and test mocks (credential.authorizedSigners)
    const currentSigners = credential.data?.authorizedSigners || credential.authorizedSigners || [];
    if (currentSigners.includes(newSignerAddress)) {
      throw new Error('Signer already authorized for this credential');
    }

    log.info(`Adding signer ${newSignerAddress}...`);
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

    log.info(`Transaction confirmed: ${txSig}`);

    return {
      transactionSignature: txSig,
      authorizedSigners: updatedSigners
    };
  } catch (error) {
    log.error('Error adding authorized signer:', { error: error });
    throw new Error(`Failed to add authorized signer: ${error.message}`);
  }
}

/**
 * Get the current list of authorized signers for a credential
 */
async function getAuthorizedSigners(credentialAddress) {
  try {
    log.info(`Fetching authorized signers for credential: ${credentialAddress}`);
    
    // Retry logic in case of timing issues with on-chain indexing
    let credential = null;
    let lastError = null;
    const maxRetries = 3;
    const retryDelayMs = 500;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        credential = await lib.fetchMaybeCredential(rpc, credentialAddress);
        log.info(`Credential fetch result:`, { value: credential });
        
        if (credential?.exists) {
          break;
        }
        
        if (attempt < maxRetries - 1) {
          log.info(`Credential not ready, retrying (attempt ${attempt + 1}/${maxRetries - 1})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      } catch (fetchError) {
        lastError = fetchError;
        log.error(`Error fetching credential (attempt ${attempt + 1}):`, { error: fetchError.message });
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }
    
    if (!credential?.exists) {
      log.info(`Credential does not exist or fetch failed after ${maxRetries} retries`);
      if (lastError) {
        log.error(`Last error:`, { error: lastError.message });
      }
      return [];
    }
    
    // Extract signers from the credential data structure
    // Handle both real sas-lib format (credential.data.authorizedSigners) and test mocks (credential.authorizedSigners)
    const signers = credential.data?.authorizedSigners || credential.authorizedSigners || [];
    log.info(`Found ${signers.length} authorized signers:`, { value: signers });
    return signers;
  } catch (error) {
    log.error('Error fetching authorized signers:', { error: error.message });
    return [];
  }
}

module.exports = {
  ensureSasCredential,
  addAuthorizedSigner,
  getAuthorizedSigners,
  kitInstructionToWeb3,
  sendTransaction
};
