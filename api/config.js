/**
 * Configuration module
 * Loads environment variables from .env file with sensible defaults
 */

require('dotenv').config();

module.exports = {
  server: {
    buildType: process.env.SCS_BUILD || 'development',
    bindHost: process.env.SCS_BIND_HOST || 'localhost',
    bindPort: parseInt(process.env.SCS_BIND_PORT || '3000', 10)
  },

  uploads: {
    path: process.env.SCS_UPLOADS_PATH || 'uploads/'
  },

  payer: {
    keypairFile: process.env.SCS_KEYPAIR_FILE || '.payer-keypair.json'
  },

  logging: {
    logFile: process.env.SCS_LOGS_FILE || 'sandbox.log'
  }
};
