const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const { payer } = require('./payer');

const connection = new web3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

/**
 * Create an SPL Token mint for a pet
 * This creates a new token that represents the pet
 * 
 * @param {PublicKey} ownerPublicKey - The owner's wallet address
 * @returns {Promise<Object>} Contains mintAddress and transaction signature
 */
async function createPetTokenMint(ownerPublicKey) {
  try {
    // Check payer balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log('Payer balance:', balance, 'lamports');
    
    if (balance < 5000000) {
      throw new Error(
        `Insufficient payer balance: ${balance} lamports. ` +
        `The payer (${payer.publicKey.toBase58()}) needs at least 0.005 SOL. ` +
        `On devnet, fund it at: https://faucet.solana.com`
      );
    }
    
    // Create the token mint
    // Each pet gets its own SPL token with 0 decimals (since we only mint 1 token per pet)
    // The payer is set as the mint authority so they can sign transactions
    const mint = await splToken.createMint(
      connection,
      payer,
      payer.publicKey,      // Mint authority (the payer who can sign)
      payer.publicKey,      // Freeze authority (the payer)
      0                     // Decimals (no fractions since 1 pet = 1 token)
    );
    
    console.log('Created token mint for pet:', mint.toBase58());
    
    return {
      mintAddress: mint.toBase58(),
      success: true
    };
  } catch (error) {
    console.error('Error creating pet token mint:', error);
    throw error;
  }
}

/**
 * Create an associated token account for the owner
 * This is where the pet token will be stored
 * 
 * @param {PublicKey} ownerPublicKey - The owner's wallet address
 * @param {PublicKey} mintAddress - The mint address of the pet token
 * @returns {Promise<Object>} Contains tokenAccount address and transaction signature
 */
async function createAssociatedTokenAccount(ownerPublicKey, mintAddress) {
  try {
    // Check payer balance
    const balance = await connection.getBalance(payer.publicKey);
    if (balance < 5000000) {
      throw new Error(
        `Insufficient payer balance: ${balance} lamports. ` +
        `The payer (${payer.publicKey.toBase58()}) needs at least 0.005 SOL. ` +
        `On devnet, fund it at: https://faucet.solana.com`
      );
    }
    
    // Get or create the associated token account
    const associatedTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      new web3.PublicKey(mintAddress),
      ownerPublicKey
    );
    
    console.log('Created/Got associated token account:', associatedTokenAccount.address.toBase58());
    
    return {
      tokenAccount: associatedTokenAccount.address.toBase58(),
      success: true
    };
  } catch (error) {
    console.error('Error creating associated token account:', error);
    throw error;
  }
}

/**
 * Mint one token to represent the pet
 * 
 * @param {string} mintAddress - The mint address
 * @param {string} tokenAccountAddress - The token account to mint to
 * @param {PublicKey} owner - The owner's public key
 * @returns {Promise<Object>} Contains transaction signature
 */
async function mintPetToken(mintAddress, tokenAccountAddress, owner) {
  try {
    // Check payer balance
    const balance = await connection.getBalance(payer.publicKey);
    if (balance < 5000000) {
      throw new Error(
        `Insufficient payer balance: ${balance} lamports. ` +
        `The payer (${payer.publicKey.toBase58()}) needs at least 0.005 SOL. ` +
        `On devnet, fund it at: https://faucet.solana.com`
      );
    }
    
    // Mint 1 token to represent the pet
    // The payer is the mint authority (they signed the transaction)
    const signature = await splToken.mintTo(
      connection,
      payer,                                            // Payer who pays for transaction
      new web3.PublicKey(mintAddress),                  // Mint address
      new web3.PublicKey(tokenAccountAddress),          // Destination token account
      payer,                                            // Authority (payer can sign)
      1                                                 // Amount to mint
    );
    
    console.log('Minted pet token, signature:', signature);
    
    return {
      signature: signature,
      success: true
    };
  } catch (error) {
    console.error('Error minting pet token:', error);
    throw error;
  }
}

/**
 * Get token information
 * 
 * @param {string} mintAddress - The mint address
 * @returns {Promise<Object>} Token information
 */
async function getTokenInfo(mintAddress) {
  try {
    const mint = await splToken.getMint(connection, new web3.PublicKey(mintAddress));
    return {
      supply: mint.supply.toString(),
      decimals: mint.decimals,
      isInitialized: mint.isInitialized,
      owner: mint.owner.toBase58()
    };
  } catch (error) {
    console.error('Error getting token info:', error);
    throw error;
  }
}

/**
 * Get associated token account balance
 * 
 * @param {string} tokenAccountAddress - The token account address
 * @returns {Promise<Object>} Token account information
 */
async function getTokenAccountBalance(tokenAccountAddress) {
  try {
    const account = await splToken.getAccount(connection, new web3.PublicKey(tokenAccountAddress));
    return {
      amount: account.amount.toString(),
      decimals: account.decimals,
      owner: account.owner.toBase58(),
      mint: account.mint.toBase58()
    };
  } catch (error) {
    console.error('Error getting token account balance:', error);
    throw error;
  }
}

module.exports = {
  createPetTokenMint,
  createAssociatedTokenAccount,
  mintPetToken,
  getTokenInfo,
  getTokenAccountBalance,
  connection
};
