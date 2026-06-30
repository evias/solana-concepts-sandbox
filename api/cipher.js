const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createLogger } = require('./logger');
const log = createLogger('cipher');

// Get or create a persistent backend cipher keypair
function initializeEncryptionKey() {
  // Use config for keypair file path
  let cipherPath = config.cipher.keypairFile;

  // If it's a relative path, resolve it relative to project root
  if (!path.isAbsolute(cipherPath)) {
    cipherPath = path.join(__dirname, '..', cipherPath);
  }

  let cipher;

  if (fs.existsSync(cipherPath)) {
    // Load existing cipher keypair
    const secretKey = JSON.parse(fs.readFileSync(cipherPath, 'utf-8'));
    cipher = new Uint8Array(secretKey);
    log.info('Loaded existing encryption key:', { path: cipherPath });
  } else {
    // Create new cipher keypair
    cipher = new Uint8Array(crypto.randomBytes(32));
    fs.writeFileSync(cipherPath, JSON.stringify(Array.from(cipher.secretKey)));
    log.info('Created new encryption key:', { value: cipherPath });
  }

  return cipher;
}

// Get or initialize the cipher
const cipher = initializeEncryptionKey();

module.exports = { 
  cipher,
  getCipherKey: () => cipher
};
