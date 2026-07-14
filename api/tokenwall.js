const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const { createLogger } = require('./logger');
const { encrypt, decrypt } = require('./hcpconsole'); 
const { getTokenAccounts } = require('./solana-tokens'); 
const log = createLogger('concept/tokenwall');
const router = express.Router();
const { tokenWallDb } = require('./database');
const { getTokenPrice } = require('./market');
const { fstat } = require('fs');

/**
 * @swagger
 * /api/v1/tokenwall/create-invoice-tx:
 *   post:
 *     tags:
 *       - TokenWall
 *     summary: Create an invoice (PDA) to permit paid access to your content.
 *     description: Creates a <script> HTML/JS to permit paid access to your content.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - issuerAddress
 *               - tokenAddress
 *               - lamports
 *             properties:
 *               issuerAddress:
 *                 type: string
 *                 description: Solana issuer wallet address
 *               tokenAddress:
 *                 type: string
 *                 description: Solana token mint address
 *               lamports:
 *                 type: number
 *                 description: Solana token amount, in lamports (smallest unit).
 *               contentSelector:
 *                 type: string
 *                 description: Query selector to find content element(s).
 *     responses:
 *       200:
 *         description: Invoice PDA created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 file:
 *                   type: object
 *                   properties:
 *                     txSig: { type: string }
 *                     invoiceRef: { type: string }
 *                     invoicePda: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/create-invoice-tx', async (req, res) => {
  try {
    const { issuerAddress, tokenAddress, lamports, contentSelector } = req.body;

    if (!issuerAddress || !tokenAddress || !lamports) {
      return res.status(402).json({ error: 'Invalid Request' });
    }

    // Import modules (same pattern as carecircle)
    const lib = require('sas-lib');
    const web3 = require('@solana/web3.js');
    const { createKeyPairSignerFromPrivateKeyBytes, createSolanaRpc } = require('@solana/kit');
    const payer = require('./payer').getPayerKeypair();
    const sasIntegration = require('./sas-integration');

    // Initialize RPC connection ("fetchMaybeX").
    const rpc = createSolanaRpc('https://api.devnet.solana.com');
    const COMPUTE_BUDGET_PROGRAM = new web3.PublicKey('ComputeBudget111111111111111111111111111111');

    log.info('Creating invoice', { 
      issuerAddress: issuerAddress,
      tokenAddress: tokenAddress,
      lamports: lamports,
      feePayer: payer.publicKey.toBase58(),
    });

    // 1: Create payer signer first (needed for all operations).
    const backendSigner = await createKeyPairSignerFromPrivateKeyBytes(
      new Uint8Array(payer.secretKey.slice(0, 32))
    );

    // 2: Create payout details (unique).
    // CAUTION: Every call to this method generates a different uuidv4.
    const payoutData = [issuerAddress, tokenAddress, lamports.toString(), uuidv4()];
    const payoutSeed = payoutData.join('-');
    const invoiceRef = uuidv4.fromString(payoutSeed);
    const scriptHtml = `
<!-- TokenWall Code -->
<script>
(function (i, s, o, g, r, a, m) {
  i['TokenWallObject'] = r; i[r] = i[r] || function () {
    (i[r].q = i[r].q || []).push(arguments);
  }; i[r].l = 1 * new Date();
  a = s.createElement(o);
  m = s.getElementsByTagName(o)[0];
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m);
})(window, document, 'script', '//${config.api.baseUrl}/tokenwall/pay.js', '_twp');
_twp('init', '${invoiceRef}', '${contentSelector}');
_twp('lock');
</script>
<!-- End TokenWall Code -->
    `;

    // 3. Create unique payment credential PDA per invoice. Each invoice has
    // exactly 1 credential PDA and schema, and each "payment" of the invoice
    // is done via sending tokens to the credential PDA.
    const issuerPubKey = web3.PublicKey(issuerAddress);
    const credentialName = crypto.createHash('sha256').update(
      payoutSeed
    ).digest().toString('hex').substring(0, 32);

    const [credentialPda] = await lib.deriveCredentialPda({
      authority: issuerAddress,
      name: credentialName
    });
    log.info('Credential PDA derived', { credentialPda, credentialName });

    const schemaName = 'TokenWall-Invoice-Basket';
    const fieldNames = ['payerAddress', 'paymentTxSig'];
    const schemaVersion = 1;

    const [schemaPda] = await lib.deriveSchemaPda({
      credential: credentialPda,
      name: schemaName,
      version: schemaVersion
    });
    log.info('Schema PDA derived', { schemaPda });

    // const nonceInput = [credentialPda, payoutSeed].join(':');
    // const nonceHash = crypto.createHash('sha256').update(nonceInput).digest();
    // const nonceKeypair = web3.Keypair.fromSeed(new Uint8Array(nonceHash.slice(0, 32)));
    // const nonce = nonceKeypair.publicKey.toString();

    // const [attestationPda] = await lib.deriveAttestationPda({
    //   credential: credentialPda,
    //   schema: schemaPda,
    //   nonce: nonce
    // });
    // log.info('Attestation PDA derived', { attestationPda });


    const transaction = new web3.Transaction();

    let credentialAccount = await lib.fetchMaybeCredential(rpc, credentialPda);
    if (!credentialAccount || credentialAccount.exists === false) {
      const createCredentialIx = lib.getCreateCredentialInstruction({
        payer: issuerAddress,
        authority: issuerAddress,
        credential: credentialPda,
        name: credentialName,
        signers: [issuerAddress],
      });
      transaction.add(createCredentialIx);
    }

    let schemaAccount = await lib.fetchMaybeSchema(rpc, schemaPda);
    if (!schemaAccount || schemaAccount.exists === false) {
      const layout = Buffer.from([12, 12]); // payerAddress, paymentTxSig in string format.
      const createSchemaIx = lib.getCreateSchemaInstruction({
        payer: issuerAddress,
        authority: issuerAddress,
        credential: credentialPda,
        schema: schemaPda,
        layout: layout,
        fieldNames: fieldNames,
        name: schemaName,
        description: 'TokenWall Payment baskets schema',
      });
      transaction.add(createSchemaIx);
    }

    // Get recent blockhash
    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    log.info('Recent blockhash:', { blockhash });

    // Set user wallet as fee payer (user pays for transaction)
    transaction.feePayer = issuerPubKey;
    log.info('Set transaction fee payer to user wallet:', { issuerPubKey });

    // Serialize unsigned transaction for user to sign via Phantom
    let serializedTx;
    try {
      log.info('Serializing unsigned transaction for user to sign...');
      serializedTx = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });
      log.info('Unsigned transaction serialized, size:', { serializedTx });
    } catch (err) {
      log.error('Error serializing transaction:', { error: err });
      log.error('Error stack:', { error: err });
      return res.status(500).json({ error: 'Failed to prepare transaction for signing', details: err.message });
    }
    const base64Tx = serializedTx.toString('base64');

    // log.info('Payment PDA derived', { paymentPda });

    // // Create tw_invoices record in database
    // log.info('Creating tw_invoices record', {wallet: issuerAddress});
    // let tw_invoices_row;
    // const invoiceId = `twpay_${invoiceRef}`;
    // scriptPayload = encrypt(scriptHtml); // encrypt using AES

    // tw_invoices_row = tokenWallDb.createInvoice({
    //   id: invoiceId,
    //   invoiceRef,
    //   issuerAddress,
    //   tokenAddress,
    //   lamports,
    //   paidtoAddress: paymentPda,
    //   scriptCipher: scriptPayload.ciphertext,
    //   scriptIV: scriptPayload.iv,
    // });

    return res.status(200).json({
      success: true,
      invoiceRef,
      paymentPda: credentialPda,
      transaction: base64Tx,
      isTestMode: false,
    });
  } catch (error) {
    if ("getLogs" in error && typeof error.getLogs !== undefined) {
      log.error('Error creating invoice', { error: error, logs: error.getLogs() });
    } else {
      log.error('Error creating invoice', { error: error.message, stack: error.stack });
    }
    return res.status(500).json({ error: 'Failed to create invoice: ' + error.message });
  }
});

/**
 * @swagger
 * /api/v1/tokenwall/submit-signed-tx:
 *   post:
 *     tags:
 *       - TokenWall
 *     summary: Submit signed invoice creation transaction
 *     description: Completes the creation of invoices payment PDAs.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceRef
 *               - signedTransaction
 *             properties:
 *               invoiceRef:
 *                 type: string
 *                 description: The invoice reference.
 *               signedTransaction:
 *                 type: string
 *                 description: Base64 signed transaction from user's wallet
 *               blockHash:
 *                 type: string
 *                 description: The block hash.
 *               blockHeight:
 *                 type: number
 *                 description: The last valid block height.
 *     responses:
 *       200:
 *         description: Invoice created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 txSig: { type: string } 
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/submit-signed-tx', async (req, res) => {
  try {
    const { blockHash, blockHeight, invoiceRef, signedTransaction } = req.body;

    log.info('Received signed transaction submission');
    log.info('invoiceRef:', { invoiceRef });

    if (!invoiceRef || !signedTransaction) {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    // Deserialize and send transaction
    let transactionSignature = '';
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = web3.Transaction.from(txBuffer);

    log.info('Deserialized signed transaction');
    log.info('Sending transaction...');

    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
    transactionSignature = await connection.sendRawTransaction(transaction.serialize());
    log.info('Transaction sent:', { transactionSignature });

    log.info('Confirming transaction...');
    await connection.confirmTransaction({
      signature: transactionSignature,
      blockhash: blockHash,
      lastValidBlockHeight: blockHeight,
    });
    log.info('Transaction confirmed');

    return res.status(200).json({
      success: true,
      invoiceRef,
      txSig: transactionSignature,
    });
  } catch (error) {
    log.error('Signed transaction submission error:', { error: error });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * @swagger
 * /api/v1/tokenwall/invoices:
 *   get:
 *     tags:
 *       - TokenWall
 *     summary: Retrieve tw_invoices entries by wallet_address.
 *     description: Retrieve tw_invoices entries by wallet_address.
 *     parameters:
 *       - in: query
 *         name: issuer
 *         required: true
 *         schema:
 *           type: string
 *         description: The Solana Wallet Address that will receive the payment(s).
 *     responses:
 *       200:
 *         description: Invoices retrieved successfully
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
 *                       id: { type: string }
 *                       invoice_ref: { type: string } 
 *                       issuer_address: { type: string }
 *                       paidto_address: { type: string }
 *                       token_address: { type: string }
 *                       amount: { type: number }
 *                       lastread_at: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/invoices', (req, res) => {
  try {
    const { issuer } = req.query;
    if (!issuer) {
      return res.status(402).json({ error: 'Invalid Request' });
    }

    let invoices = tokenWallDb.getInvoicesByIssuerAddress(issuer, 5);
    for (let i = 0; i < invoices.length; i++) {
      delete invoices[i].script_cipher;
      delete invoices[i].cipher_iv;
    }

    return res.json({ invoices: invoices });
  } catch (error) {
     log.error('Error listing invoices', { error });
     return res.status(500).json({ error: 'Failed to list invoices' });
   }
});

/**
 * @swagger
 * /api/v1/tokenwall/pay.js:
 *   get:
 *     tags:
 *       - TokenWall
 *     summary: Retrieve the TokenWall pay.js javascript source code.
 *     description: Retrieves the TokenWall pay.js javascript source code.
 *     responses:
 *       200:
 *         description: Script retrieved successfully.
 *         content:
 *           application/javascript:
 *             schema:
 *               type: string
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/pay.js', (req, res) => {
  const fs = require('fs');
  const path = require('path');

  const filePath = path.join(__dirname, '..', 'assets', 'tokenwallcli.iife.js');
  const payjsSrc = fs.readFileSync(filePath);

  res.set('Content-Type', 'application/javascript');
  return res.status(200).send(payjsSrc);
});

/**
 * @swagger
 * /api/v1/tokenwall/tokens:
 *   get:
 *     tags:
 *       - TokenWall
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
  try {
    const { wallet_address, cluster } = req.query;

    let useCluster = "devnet";
    if (cluster && cluster.length) useCluster = cluster;

    let rpcUrl;
    if (useCluster.toLowerCase() === "devnet") {
      rpcUrl = 'https://api.devnet.solana.com';
    } else {
      rpcUrl = 'https://api.mainnet.solana.com';
    }

    const web3 = require('@solana/web3.js');
    const connection = new web3.Connection(rpcUrl, 'confirmed');

    const solanaPriceEur = await getTokenPrice('wrapped-solana', 'SOL');
    const usdcPriceEur = await getTokenPrice('usd-coin', 'USDC');
    const eurcPriceEur = await getTokenPrice('euro-coin', 'EURC');

    //XXX extract known tokens
    const knownTokens = [
      {
        mintAddress: 'So11111111111111111111111111111111111111112',
        name: 'SOL',
        tokenAmount: 0,
        decimals: 9,
        priceEur: solanaPriceEur,
      },
      {
        mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USDC',
        tokenAmount: 0,
        decimals: 6,
        priceEur: usdcPriceEur,
      },
      {
        mintAddress: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
        name: 'EURC',
        tokenAmount: 0,
        decimals: 6,
        priceEur: eurcPriceEur,
      },
      {
        mintAddress: 'DHP1KmBeJePxh7EiptdpEt9E2G5cQRDTdkJooZMmDtKG',
        name: 'DHP',
        tokenAmount: 0,
        decimals: 9,
      },
      {
        mintAddress: 'AidHczUkwDnW7c1Lc89tTiP71dTqeEa52LgV6GxsfwYd',
        name: 'AIDH',
        tokenAmount: 0,
        decimals: 6,
      }
    ];

    if (wallet_address && wallet_address.length) {
      const ownedTokens = await getTokenAccounts(wallet_address, connection);

      for (let i = 0; i < ownedTokens.length; i++) {
        const knownToken = knownTokens.findIndex(
          t => t.mintAddress === ownedTokens[i].mintAddress
        );

        if (knownToken !== -1) {
          knownTokens[knownToken].tokenAmount = ownedTokens[i].tokenAmount;
        } else { 
          knownTokens.push(ownedTokens[i]);
        }
      }
    }

    return res.status(200).json({ tokens: knownTokens });
  } catch (error) {
    log.error('Error listing tokens', { error });
    return res.status(500).json({ error: 'Failed to list tokens' });
  }
});

module.exports = router;
