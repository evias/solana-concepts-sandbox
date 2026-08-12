const express = require('express');
const config = require('./config');
const { createLogger } = require('./logger');
const { encrypt, decrypt } = require('./aes-integration'); 
const { getTokenAccounts } = require('./solana-tokens'); 
const log = createLogger('concept/tokenwall');
const router = express.Router();
const { tokenizerDb } = require('./database');
const { getTokenPrice } = require('./market');

/**
 * @swagger
 * /api/v1/tokenizer/assets:
 *   get:
 *     tags:
 *       - Tokenizer
 *     summary: Retrieve rwa_assets entries by wallet_address.
 *     description: Retrieve rwa_assets entries by wallet_address.
 *     parameters:
 *       - in: query
 *         name: issuer
 *         required: true
 *         schema:
 *           type: string
 *         description: The Solana Wallet Address that tokenized assets.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: number
 *         description: The pagination page number.
 *     responses:
 *       200:
 *         description: Assets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: number
 *                 total:
 *                   type: number
 *                 assets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       identifier: { type: string }
 *                       label: { type: string }
 *                       rwa_type: { type: string }
 *                       legal_type: { type: string }
 *                       reg_signature: { type: string }
 *                       registry_type: { type: string }
 *                       registry_data: { type: string }
 *                       issuer_address: { type: string }
 *                       issuer_sas_address: { type: string }
 *                       custodian_sas_address: { type: string }
 *                       schema_sas_address: { type: string }
 *                       token_mint_address: { type: string }
 *                       created_at: { type: string }
 *                       updated_at: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/assets', (req, res) => {
  try {
    const { issuer, page } = req.query;
    if (!issuer) {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    let displayPage = !page ? 1 : page;
    const maxPerPage = 10;
    const offsetPage = (displayPage-1) * maxPerPage;
    let assets = tokenizerDb.getAssetsByIssuerAddress(issuer, maxPerPage, offsetPage);

    const cntAssets = tokenizerDb.getAssetsCount(issuer);
    return res.status(200).json({
      assets: assets,
      page: displayPage,
      total: cntAssets,
    });
  } catch (error) {
    log.error('Error listing assets', { error });
    return res.status(500).json({ error: 'Failed to list assets' });
  }
});

/**
 * @swagger
 * /api/v1/tokenizer/credentials:
 *   get:
 *     tags:
 *       - Tokenizer
 *     summary: List credentials owned by wallet
 *     description: Returns all credentials where the wallet is the owner.
 *     parameters:
 *       - in: query
 *         name: wallet
 *         required: false
 *         schema:
 *           type: string
 *         description: Solana wallet address
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: number
 *         description: The maximum number of rows to return.
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: number
 *         description: The number of rows to skip in response.
 *     responses:
 *       200:
 *         description: Credentials retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 credentials:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       wallet_address: { type: string }
 *                       full_name: { type: string }
 *                       date_of_birth: { type: string }
 *                       profession: { type: string }
 *                       email: { type: string }
 *                       did_id: { type: string }
 *                       sas_credential_id: { type: string }
 *                       sas_credential_address: { type: string }
 *                       mint_address: { type: string }
 *                       transaction_signature: { type: string }
 *                       badges_count: { type: string }
 *                       created_at: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/credentials', async (req, res) => {
  let { wallet, limit, offset } = req.query;
  if (!!wallet && wallet.length != 44) {
    return res.status(400).json({ error: 'Invalid Request' });
  }
  if (!limit || limit < 0) limit = 25;
  if (!offset || offset < 0) offset = 0;

  const params = [
    'limit=' + limit,
    'offset=' + offset,
  ];
  if (!!wallet) params.push('wallet=' + wallet);

  return res.redirect(`/api/v1/healthcred/credentials?${params.join('&')}`);
});

/**
 * @swagger
 * /api/v1/tokenizer/tokens:
 *   get:
 *     tags:
 *       - Tokenizer
 *     summary: Retrieve known tokens and/or owned tokens by wallet_address.
 *     description: Retrieve known tokens and/or owned tokens by wallet_address.
 *     parameters:
 *       - in: query
 *         name: wallet_address
 *         required: false
 *         schema:
 *           type: string
 *         description: The Solana Wallet Address to read owned tokens from.
 *       - in: query
 *         name: cluster
 *         required: false
 *         schema:
 *           type: string
 *         description: The Solana cluster from which to read token account balances.
 *     responses:
 *       200:
 *         description: Tokens retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prompts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       mintAddress: { type: string }
 *                       name: { type: string }
 *                       balance: { type: number }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/tokens', async (req, res) => {
  return res.redirect('/api/v1/tokenwall/tokens');
});

module.exports = router;
