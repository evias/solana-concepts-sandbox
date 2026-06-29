/**
 * System API Routes
 * 
 * Manages system version, and general information.
 */

const express = require('express');
const { createLogger } = require('./logger');
const log = createLogger('core/system');
const config = require('./api/config');
const child_process = require('node:child_process');

const router = express.Router();

/**
 * GET /info
 * Retrieve system information
 * 
 * Returns: System information including appVersion.
 */
/**
 * @swagger
 * /api/v1/system/info:
 *   get:
 *     tags:
 *       - System
 *     summary: Retrieve system information
 *     description: Retrieves system information including the appVersion.
 *     responses:
 *       200:
 *         description: System information retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appVersion:
 *                   type: string
 *                 payerAddress:
 *                   type: string
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/info', async (req, res) => {
  const gitHash = child_process.execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const gitTag = child_process.execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  const payerAddr = require('./payer').getPayerKeypair().publicKey.toBase58();

  let appVersion = gitTag + "-" + gitHash;
  if (config.server.buildType !== 'production') {
    appVersion = appVersion + "-dev";
  }

  return res.status(200).json({
    appVersion: appVersion,
    payerAddress: payerAddr,
  });
});
