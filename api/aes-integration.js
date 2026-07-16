const crypto = require('crypto');
const config = require('./config');
const { createLogger } = require('./logger');
const log = createLogger('core/crypto');

const cipher_algo = config.cipher.algorithm;

/**
 * Helper: Encrypt text using AES and a configured encryption key.
 */
function encrypt(message) {
  try {
    const secretKey = require('./cipher').getCipherKey();
    if (secretKey.length != 32) {
      throw new Error(`Expected encryption key size of 32 bytes; got: ${secretKey.length}b`);
    }

    const iv = crypto.randomBytes(16); // random 16b IV
    const cipher = crypto.createCipheriv(cipher_algo, secretKey, iv);

    let ciphertext = cipher.update(message, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      ciphertext,
    };
   } catch (error) {
     log.error('Error encrypting message', { error: error.message });
     return null;
   }
}

/**
 * Helper: Decrypt text using AES and a configured encryption key.
 */
function decrypt(cipherObj) {
  try {
    if (!cipherObj || !cipherObj.iv || !cipherObj.ciphertext) {
      throw new Error(`Invalid encrypted payload, must contain fields: iv, ciphertext.`);
    }

    const secretKey = require('./cipher').getCipherKey();
    if (secretKey.length != 32) {
      throw new Error(`Expected encryption key size of 32 bytes; got: ${secretKey.length}b`);
    }

    const decipher = crypto.createDecipheriv(
      cipher_algo,
      secretKey,
      Buffer.from(cipherObj.iv, 'hex')
    );

    let message = decipher.update(cipherObj.ciphertext, 'hex', 'utf8');
    message += decipher.final('utf8');
    return message;
  } catch (error) {
     log.error('Error decrypting message', { error: error.message });
     return null;
   }
}

module.exports = { encrypt, decrypt };
