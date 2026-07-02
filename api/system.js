/**
 * System API Routes
 * 
 * Manages system version, and general information.
 */
const fs = require('fs');
const path = require('path');
const child_process = require('node:child_process');
const express = require('express');
const config = require('./config');

const router = express.Router();

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
router.get('/info', (req, res) => {
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

/**
 * @swagger
 * /api/v1/system/license:
 *   get:
 *     tags:
 *       - System
 *     summary: Retrieve program license
 *     description: Retrieves program license.
 *     responses:
 *       200:
 *         description: License retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 license:
 *                   type: string
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/license', (req, res) => {
  const licensePath = path.join(__dirname, '..', 'LICENSE');
  if (!fs.existsSync(licensePath)) {
    return res.status(500).json({ error: 'License file is missing.' });
  }

  const licenseMd = fs.readFileSync(licensePath, 'utf-8')
  return res.status(200).json({
    license: licenseMd,
  });
});

module.exports = router;
