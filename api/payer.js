const web3 = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createLogger } = require('./logger');
const log = createLogger('payer');

// Get or create a persistent backend payer keypair
function initializePayerKeypair() {
  // Use config for keypair file path
  let payerPath = config.payer.keypairFile;
  
  // If it's a relative path, resolve it relative to project root
  if (!path.isAbsolute(payerPath)) {
    payerPath = path.join(__dirname, '..', payerPath);
  }
  
  let payer;
  
  if (fs.existsSync(payerPath)) {
    // Load existing payer keypair
    const secretKey = JSON.parse(fs.readFileSync(payerPath, 'utf-8'));
    payer = web3.Keypair.fromSecretKey(new Uint8Array(secretKey));
    log.info('Loaded existing payer keypair:', { value: payer.publicKey.toBase58() });
  } else {
    // Create new payer keypair
    payer = web3.Keypair.generate();
    fs.writeFileSync(payerPath, JSON.stringify(Array.from(payer.secretKey)));
    log.info('Created new payer keypair:', { value: payer.publicKey.toBase58() });
    log.info('Saved payer keypair to:', { value: payerPath });
    log.info('⚠️  IMPORTANT: Fund this address with SOL to use the app:');
    log.info('   Address:', { value: payer.publicKey.toBase58() });
    log.info('   On devnet, use: https://faucet.solana.com');
  }
  
  return payer;
}

// Get or initialize the payer
const payer = initializePayerKeypair();

module.exports = { 
  payer,
  getPayerKeypair: () => payer
};
