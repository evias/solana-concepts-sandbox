const web3 = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Get or create a persistent backend payer keypair
function initializePayerKeypair() {
  const payerPath = path.join(__dirname, '..', '.payer-keypair.json');
  
  let payer;
  
  if (fs.existsSync(payerPath)) {
    // Load existing payer keypair
    const secretKey = JSON.parse(fs.readFileSync(payerPath, 'utf-8'));
    payer = web3.Keypair.fromSecretKey(new Uint8Array(secretKey));
    console.log('Loaded existing payer keypair:', payer.publicKey.toBase58());
  } else {
    // Create new payer keypair
    payer = web3.Keypair.generate();
    fs.writeFileSync(payerPath, JSON.stringify(Array.from(payer.secretKey)));
    console.log('Created new payer keypair:', payer.publicKey.toBase58());
    console.log('Saved payer keypair to:', payerPath);
    console.log('⚠️  IMPORTANT: Fund this address with SOL to use the app:');
    console.log('   Address:', payer.publicKey.toBase58());
    console.log('   On devnet, use: https://faucet.solana.com');
  }
  
  return payer;
}

// Get or initialize the payer
const payer = initializePayerKeypair();

module.exports = { payer };
