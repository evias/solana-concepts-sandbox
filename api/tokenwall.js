const express = require('express');
const crypto = require('crypto');
const { v5: uuidv5 } = require('uuid');
const config = require('./config');
const { createLogger } = require('./logger');
const { encrypt, decrypt } = require('./aes-integration'); 
const { getTokenAccounts } = require('./solana-tokens'); 
const log = createLogger('concept/tokenwall');
const router = express.Router();
const { tokenWallDb } = require('./database');
const { getTokenPrice } = require('./market');
const { fstat } = require('fs');
const solanaPay = require('@solana-commerce/solana-pay');

// uuidv5("SCS (Solana Concepts Sandbox) by Grégory Saive for re:Software S.L.", "d9e6d386-7fa4-11f1-9690-325096b39f47")
const SCS_UUID_NAMESPACE = "e399d4c4-afd2-558f-bfcc-b938393c33ee";

//XXX refactor known token mint addresses.
const SCS_SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SCS_USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SCS_EURC_MINT_ADDRESS = 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr';
const SCS_DHP_MINT_ADDRESS = 'DHP1KmBeJePxh7EiptdpEt9E2G5cQRDTdkJooZMmDtKG';
const SCS_AIDH_MINT_ADDRESS = 'AidHczUkwDnW7c1Lc89tTiP71dTqeEa52LgV6GxsfwYd';

const knownTokens = [
  {
    mintAddress: SCS_SOL_MINT_ADDRESS,
    name: 'SOL',
    tokenAmount: 0,
    decimals: 9,
    priceEur: 0,
  },
  {
    mintAddress: SCS_USDC_MINT_ADDRESS,
    name: 'USDC',
    tokenAmount: 0,
    decimals: 6,
    priceEur: 0,
  },
  {
    mintAddress: SCS_EURC_MINT_ADDRESS,
    name: 'EURC',
    tokenAmount: 0,
    decimals: 6,
    priceEur: 0,
  },
  {
    mintAddress: SCS_DHP_MINT_ADDRESS,
    name: 'DHP',
    tokenAmount: 0,
    decimals: 9,
  },
  {
    mintAddress: SCS_AIDH_MINT_ADDRESS,
    name: 'AIDH',
    tokenAmount: 0,
    decimals: 6,
  }
];

// Helper to shorten the display of Solana Wallet Addresses.
// Returns a string.
const shortenAddr = (addr) => {
  if (!addr || addr.length < 10) return addr;
  return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4)
};

// Formats a token amount with a given token symbol (token.name)
// and uses `toFixed()` to display the correct number of decimals.
// Returns a string.
const actualTokenAmount = (token, amt) => {
  const decimals = token.decimals;
  const totalAmt = amt / (Math.pow(10, decimals));
  return totalAmt.toFixed(decimals) + ' ' + token.name;
};

// Virtual invoice status discovery, retrieves all payments for a pair
// of invoice ID and payment reference, then takes paid vs. expected amount.
// Returns an object: {status,amountPaid}.
const getInvoiceStatus = (invoiceRef, paymentRef) => {
  const invoice = tokenWallDb.getInvoiceByRef(invoiceRef);
  const cntPayments = tokenWallDb.getPaymentsCountByInvoiceAndRef(invoice.id, paymentRef);
  if (cntPayments === 0) {
    return { status: 'pending', amountPaid: 0 };
  }

  const allPayments = tokenWallDb.getPaymentsByInvoiceAndRef(invoice.id, paymentRef);
  const totalPaid = allPayments.reduce((acc, cur) => {
    return acc + Number(cur.amount_paid);
  }, 0);

  if (totalPaid >= invoice.lamports) {
    return { status: 'accepted', amountPaid: totalPaid };
  } else if (totalPaid > 0) {
    return { status: 'partial', amountPaid: totalPaid };
  }

  return { status: 'pending', amountPaid: 0 };
};

// Manual verification helper for received amounts.
// NOTE: The returned amount will be positive.
// Returns a number.
const extractTransactionAmount = (pref, sig, tx, addr, mint) => {
  // Only check balances for relevant transactions.
  const sigMemoFormat = `[${pref.length}] ${pref}`; // Solana signature.memo format.
  if (!pref || !sig.memo || sig.memo !== sigMemoFormat) {
    return 0;
  }

  const pre = tx.meta.preTokenBalances.find(
    (b) => b.owner === addr && b.mint === mint
  );
  const post = tx.meta.postTokenBalances.find(
    (b) => b.owner === addr && b.mint === mint
  );

  const preAmount = BigInt(pre?.uiTokenAmount.amount ?? "0");
  const postAmount = BigInt(post?.uiTokenAmount.amount ?? "0");
  const diff = postAmount - preAmount;
  return diff;
};

// Manual token balances discovery for tokens that can be withdrawn.
// Returns an array of objects: [{name,owner,decimals,total}].
const getWithdrawableTokenBalances = async (issuerAddress, connection) => {
  const incomeRows = tokenWallDb.getIncomeByTokens(issuerAddress);
  const balanceRows = tokenWallDb.getIncomeAddresses(issuerAddress);
  // log.info(`Found balance rows for issuer: ${issuerAddress}`, { balanceRows });

  const balances = []; // balances contains withdrawable tokens
  for (let i = 0; i < balanceRows.length; i++) {
    const hasIncome = incomeRows.find(
      r => r.token_address === balanceRows[i].mint && r.total > 0
    );
    if (!hasIncome) continue;

    const knownToken = knownTokens.find(
      t => t.mintAddress === balanceRows[i].mint
    );

    const paymentAddress = balanceRows[i].address;
    const ownedTokens = await getTokenAccounts(paymentAddress, connection);
    // log.info("Downloaded token accounts: ", {ownedTokens});

    const balanceForToken = ownedTokens.find(
      t => t.mintAddress === balanceRows[i].mint && t.lamports > 0
    );

    if (!! balanceForToken) {
      balances.push({
        name: !!knownToken ? knownToken.name : balanceRows[i].mint,
        paymentPda: paymentAddress,
        paymentAta: balanceForToken.pubKey,
        decimals: !!knownToken ? knownToken.decimals : 9,
        total: balanceForToken.lamports,
      });
    }
  }

  return balances;
};

/**
 * @swagger
 * /api/v1/tokenwall/create-invoice-tx:
 *   post:
 *     tags:
 *       - TokenWall
 *     summary: Create an invoice transaction to be signed by the issuer wallet.
 *     description: Creates an invoice transaction to be signed by the issuer wallet.
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
 *                 blockhash: { type: object }
 *                 invoiceRef: { type: string }
 *                 transaction: { type: string }
 *                 isTestMode: { type: boolean }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/create-invoice-tx', async (req, res) => {
  try {
    const { issuerAddress, tokenAddress, lamports, contentSelector } = req.body;

    if (!issuerAddress || !tokenAddress || !lamports) {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    const lib = require('sas-lib');
    const web3 = require('@solana/web3.js');
    const { createSolanaRpc } = require('@solana/kit');
    const sasIntegration = require('./sas-integration');

    // Initialize RPC connection ("fetchMaybeX").
    const rpc = createSolanaRpc('https://api.devnet.solana.com');
    const COMPUTE_BUDGET_PROGRAM = new web3.PublicKey('ComputeBudget111111111111111111111111111111');
    const MEMO_PROGRAM = new web3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

    // 2: Create payout details (unique).
    // CAUTION: Every call to this method generates a different uuidv5.
    const payoutData = [issuerAddress, tokenAddress, lamports.toString(), new Date().toJSON()];
    const payoutSeed = payoutData.join('-');
    const invoiceRef = uuidv5(payoutSeed, SCS_UUID_NAMESPACE);

    log.info('Creating invoice', { 
      issuerAddress,
      tokenAddress,
      lamports: lamports,
      feePayer: issuerAddress,
      contentSelector,
      invoiceRef,
      payoutSeed,
    });

    const issuerPubKey = new web3.PublicKey(issuerAddress);
    const transaction = new web3.Transaction();

    // Add compute budget instruction for max. 50k
    const computeBudgetInstruction = new web3.TransactionInstruction({
      programId: COMPUTE_BUDGET_PROGRAM,
      keys: [],
      data: Buffer.concat([
        Buffer.from([0x02]), // SetComputeUnitLimit instruction discriminator
        Buffer.alloc(4) // 4 bytes buffer for compute units
      ])
    });
    computeBudgetInstruction.data.writeUInt32LE(50000, 1); // after discriminator
    transaction.add(computeBudgetInstruction);

    const memoBuffer = Buffer.from(invoiceRef, 'utf8');
    transaction.add(
      new web3.TransactionInstruction({
        programId: MEMO_PROGRAM,
        keys: [],
        data: memoBuffer
      })
    );

    // Get recent blockhash
    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    transaction.version = "legacy";
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
      log.info(`Unsigned transaction serialized, size: ${serializedTx.length}`);
    } catch (err) {
      log.error('Error serializing transaction:', { error: err.message });
      log.error('Error stack:', { error: err.stack });
      return res.status(500).json({ error: 'Failed to prepare transaction for signing', details: err.message });
    }
    const base64Tx = serializedTx.toString('base64');

    return res.status(200).json({
      success: true,
      blockhash,
      invoiceRef,
      transaction: base64Tx,
      isTestMode: false,
    });
  } catch (error) {
    if ("getLogs" in error && typeof error.getLogs !== undefined) {
      log.error('Error creating invoice', { error: error.message, logs: error.getLogs() });
    } else {
      log.error('Error creating invoice', { error: error.message, stack: error.stack });
    }
    return res.status(500).json({ error: 'Failed to create invoice: ' + error.message });
  }
});

/**
 * @swagger
 * /api/v1/tokenwall/submit-signed-transaction:
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
 *               - blockHash
 *               - maxBlockHeight
 *               - issuerAddress
 *               - tokenAddress
 *               - lamports
 *               - contentSelector
 *               - useCluster
 *               - invoiceObjects
 *             properties:
 *               invoiceRef:
 *                 type: string
 *                 description: The invoice reference.
 *               signedTransaction:
 *                 type: string
 *                 description: Base64 signed transaction from user's wallet.
 *               blockHash:
 *                 type: string
 *                 description: The block hash.
 *               maxBlockHeight:
 *                 type: number
 *                 description: The last valid block height.
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
 *               useCluster:
 *                 type: string
 *                 description: A solana cluster in lowercase.
 *               invoiceObjects:
 *                 type: array
 *                 description: An array of paid asset objects.
 *     responses:
 *       200:
 *         description: Invoice created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 invoiceId: { type: string }
 *                 invoiceRef: { type: string }
 *                 paymentPda: { type: string }
 *                 txSig: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/submit-signed-transaction', async (req, res) => {
  try {
    const {
      blockHash, maxBlockHeight, invoiceRef, signedTransaction,
      issuerAddress, tokenAddress, lamports, contentSelector,
      useCluster, invoiceObjects, invoiceType,
    } = req.body;

    log.info('Received signed transaction submission');
    log.info('invoiceRef:', { invoiceRef });

    if (!invoiceRef || !signedTransaction) {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    const web3 = require('@solana/web3.js');

    // Deserialize and send transaction
    let transactionSignature = '';
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = web3.Transaction.from(txBuffer);

    log.info(`Deserialized signed transaction, size: ${txBuffer.length}`);
    log.info('Sending transaction...');

    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
    transactionSignature = await connection.sendRawTransaction(transaction.serialize());
    log.info('Transaction sent:', { transactionSignature });

    log.info('Confirming transaction...');
    await connection.confirmTransaction({
      signature: transactionSignature,
      blockhash: blockHash,
      lastValidBlockHeight: maxBlockHeight,
    });
    log.info('Transaction confirmed');

    const scriptHtml = `
<!-- TokenWall Code -->
<script>
(function (i, s, o, g, r, a, m) { i['TokenWallObject'] = r; i[r] = i[r] ||
  function () {
    (i[r].q = i[r].q || []).push(arguments);
  }; i[r].l = 1 * new Date(); a = s.createElement(o);
  m = s.getElementsByTagName(o)[0]; a.async = 1;
  a.src = g; m.parentNode.insertBefore(a, m);
})(window, document, 'script', '//${config.api.baseUrl}/tokenwall/pay.js', '_twp');
_twp('init', '${invoiceRef}', '${contentSelector}');
_twp('lock', '${config.api.baseUrl}');
</script>
<!-- End TokenWall Code -->
    `;

    // Create tw_invoices record in database
    log.info('Creating tw_invoices record', {wallet: issuerAddress});
    let tw_invoices_row;
    const invoiceId = `twpay_${invoiceRef}`;
    const scriptPayload = encrypt(scriptHtml); // encrypt using AES

    tw_invoices_row = tokenWallDb.createInvoice({
      id: invoiceId,
      invoiceRef,
      issuerAddress,
      tokenAddress,
      lamports,
      useCluster,
      paidtoAddress: issuerAddress,
      scriptCipher: scriptPayload.ciphertext,
      scriptIV: scriptPayload.iv,
    });

    for (let o = 1, i = 0; o <= invoiceObjects.length; o++, i++) {
      log.info('Creating tw_invoice_objects record', {invoice: tw_invoices_row.id});
      let tw_invoice_objects_row;
      const objectId = `${invoiceId}-${o}`;

      const mimePayload = encrypt(invoiceObjects[i].mimeType); // encrypt using AES
      const urlPayload = encrypt(invoiceObjects[i].downloadLink); // encrypt using AES

      tw_invoice_objects_row = tokenWallDb.addObject({
        id: objectId,
        invoiceId: invoiceId,
        mimeEncrypted: mimePayload.ciphertext,
        mimeIV: mimePayload.iv,
        urlEncrypted: urlPayload.ciphertext,
        urlIV: urlPayload.iv,
        maxDownloads: 0, // XXX add maxDownloads field in form
      })
    }

    return res.status(200).json({
      success: true,
      invoiceId,
      invoiceRef,
      paymentPda: issuerAddress,
      txSig: transactionSignature,
    });
  } catch (error) {
    log.error('Signed transaction submission error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * @swagger
 * /api/v1/tokenwall/add-invoice-object:
 *   post:
 *     tags:
 *       - TokenWall
 *     summary: Add an invoice object.
 *     description: Create a new invoice object (asset).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceId
 *               - mimeType
 *               - downloadLink
 *             properties:
 *               invoiceId:
 *                 type: string
 *                 description: The invoice id.
 *               mimeType:
 *                 type: string
 *                 description: An extended mimetype value, e.g. image/*.
 *               downloadLink:
 *                 type: string
 *                 description: The plain text download link for the asset.
 *     responses:
 *       200:
 *         description: Invoice object created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 invoiceId: { type: string }
 *                 objectId: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/add-invoice-object', async (req, res) => {
  try {
    const {
      invoiceId, mimeType, downloadLink,
    } = req.body;

    if (!invoiceId || !mimeType || !downloadLink) {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    // Verify existence of invoice by id
    const invoice = tokenWallDb.getInvoiceById(invoiceId);
    if (!invoice || !invoice.cipher_iv || !invoice.script_cipher) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const cntObjects = tokenWallDb.getObjectsCountByInvoiceId(invoiceId);

    log.info('Creating tw_invoice_objects record', {invoice: invoiceId, cntObjects});
    let tw_invoice_objects_row;
    const objectId = `${invoiceId}-${cntObjects+1}`;
    const mimePayload = encrypt(mimeType); // encrypt using AES
    const urlPayload = encrypt(downloadLink); // encrypt using AES

    tw_invoice_objects_row = tokenWallDb.addObject({
      id: objectId,
      invoiceId: invoiceId,
      mimeEncrypted: mimePayload.ciphertext,
      mimeIV: mimePayload.iv,
      urlEncrypted: urlPayload.ciphertext,
      urlIV: urlPayload.iv,
      maxDownloads: 0, // XXX add maxDownloads field in form
    })

    return res.status(200).json({
      success: true,
      invoiceId,
      objectId,
    });
  } catch (error) {
    log.error('Error adding invoice object:', { error: error.message, stack: error.stack });
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
 *         description: The Solana Wallet Address that issued invoices.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: number
 *         description: The pagination page number.
 *     responses:
 *       200:
 *         description: Invoices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: number
 *                 total:
 *                   type: number
 *                 invoices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       issuer_address: { type: string }
 *                       paidto_address: { type: string }
 *                       token_address: { type: string }
 *                       invoice_ref: { type: string }
 *                       num_reads: { type: number }
 *                       lastread_at: { type: string }
 *                       created_at: { type: string }
 *                       updated_at: { type: string }
 *                       lamports: { type: number }
 *                       sol_cluster: { type: string }
 *                       cnt_assets: { type: number }
 *                       cnt_payments: { type: number }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/invoices', (req, res) => {
  try {
    const { issuer, page } = req.query;
    if (!issuer) {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    let displayPage = !page ? 1 : page;
    const maxPerPage = 10;
    const offsetPage = (displayPage-1) * maxPerPage;
    let invoices = tokenWallDb.getInvoicesByIssuerAddress(issuer, maxPerPage, offsetPage);
    for (let i = 0; i < invoices.length; i++) {
      delete invoices[i].script_cipher;
      delete invoices[i].cipher_iv;

      invoices[i].cnt_assets = tokenWallDb.getObjectsCountByInvoiceId(invoices[i].id);
      invoices[i].cnt_payments = tokenWallDb.getPaymentsCountByInvoiceId(invoices[i].id);
    }

    const cntInvoices = tokenWallDb.getInvoicesCount(issuer);
    return res.status(200).json({
      invoices: invoices,
      page: displayPage,
      total: cntInvoices,
    });
  } catch (error) {
     log.error('Error listing invoices', { error });
     return res.status(500).json({ error: 'Failed to list invoices' });
   }
});

/**
 * @swagger
 * /api/v1/tokenwall/invoice:
 *   get:
 *     tags:
 *       - TokenWall
 *     summary: Retrieve tw_invoices.script_cipher in plaintext by invoice_ref
 *     description: Retrieves tw_invoices.script_cipher in plaintext by invoice_ref.
 *     parameters:
 *       - in: query
 *         name: invoiceRef
 *         required: true
 *         schema:
 *           type: string
 *         description: The invoice reference field.
 *       - in: query
 *         name: paymentRef
 *         required: true
 *         schema:
 *           type: string
 *         description: A unique payment reference included as a memo (on-chain).
 *       - in: query
 *         name: enableMeta
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Whether to include metadata.
 *     responses:
 *       200:
 *         description: Invoice for payment reference retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentUrl: { type: string }
 *                 qrCode: { type: string }
 *                 status: { type: string }
 *                 issuerAddress: { type: string }
 *                 tokenAddress: { type: string }
 *                 paymentAddress: { type: string }
 *                 invoiceId: { type: string }
 *                 invoiceRef: { type: string }
 *                 amountLamports: { type: number }
 *                 amountPaid: { type: number }
 *                 tokenSymbol: { type: string }
 *                 uiPaidAmount: { type: string }
 *                 uiTokenAmount: { type: string }
 *                 lastRead: { type: string }
 *                 script: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/invoice', async (req, res) => {
  const { invoiceRef, paymentRef, enableMeta } = req.query;
  if (!invoiceRef || !paymentRef) {
    return res.status(400).json({ error: 'Invalid Request' });
  }

  let invoice;
  invoice = tokenWallDb.getInvoiceByRef(invoiceRef);

  if (!invoice || !invoice.cipher_iv || !invoice.script_cipher) {
    return res.status(404).json({ error: 'Not Found' });
  }

  const cleartextScript = decrypt({
    iv: invoice.cipher_iv,
    ciphertext: invoice.script_cipher
  });

  if (!cleartextScript) {
    return res.status(500).json({ error: 'Decryption failed: unknown error' });
  }

  // UPDATE tw_invoices.lastread_at
  invoice = tokenWallDb.updateLastRead(invoice.id);

  // CAUTION: // FIXME:
  // solana-pay assumes 9 decimals for SPL Tokens, so for any token
  // where we know that there is less decimals, we need to adapt the amount.
  let invoiceAmount = invoice.lamports;
  switch (invoice.token_address) {
    default: break;
    case SCS_AIDH_MINT_ADDRESS: // 6 decimals
    case SCS_USDC_MINT_ADDRESS: // 6 decimals
    case SCS_EURC_MINT_ADDRESS: // 6 decimals
      invoiceAmount = invoiceAmount * 1000;
    break;
  }
  // END CAUTION

  // SOL payment (no "splToken").
  let payParams = {
    recipient: invoice.paidto_address,
    amount: BigInt(invoiceAmount),
    label: `TokenWall Invoice`,
    message: `Payment for invoice ${invoice.invoice_ref}`,
    memo: paymentRef,
  };
  if (invoice.token_address !== SCS_SOL_MINT_ADDRESS) {
    payParams.splToken = invoice.token_address;
  }

  const paymentUrl = solanaPay.encodeURL(payParams);
  const payQrCode = await solanaPay.createStyledQRCode(paymentUrl.toString(), {
    width: 200,
    color: {
      dark: "#9945FF", // Solana purple
      light: "#FFFFFF"
    },
    errorCorrectionLevel: "M",
  });

  let response = {
    script: cleartextScript,
  };
  if (!!enableMeta) {
    const knownToken = knownTokens.find(
      t => t.mintAddress === invoice.token_address
    );
    const tokenSymbol = !!knownToken ? knownToken.name : `SPL (${shortenAddr(invoice.token_address)})`;
    const paymentsState = getInvoiceStatus(invoiceRef, paymentRef);

    let uiTokenAmount, uiPaidAmount;
    if (!!knownToken) {
      uiTokenAmount = actualTokenAmount(knownToken, invoice.lamports);
      uiPaidAmount = actualTokenAmount(knownToken, paymentsState.amountPaid);
    } else {
      let kt = { name: tokenSymbol, decimals: 9 };
      uiTokenAmount = actualTokenAmount(kt, invoice.lamports);
      uiPaidAmount = actualTokenAmount(kt, paymentsState.amountPaid);
    }

    response = {
      paymentUrl,
      qrCode: payQrCode,
      status: paymentsState.status,
      issuerAddress: invoice.issuer_address,
      tokenAddress: invoice.token_address,
      paymentAddress: invoice.paidto_address,
      invoiceId: invoice.id,
      invoiceRef: invoice.invoice_ref,
      amountLamports: invoice.lamports,
      amountPaid: paymentsState.amountPaid,
      tokenSymbol: tokenSymbol,
      uiPaidAmount,
      uiTokenAmount,
      lastRead: invoice.lastread_at,
      script: cleartextScript
    };
  }

  return res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/tokenwall/status:
 *   get:
 *     tags:
 *       - TokenWall
 *     summary: Retrieve payment statuses for an invoiceRef and paymentRef.
 *     description: Retrieves payment statuses for an invoiceRef and paymentRef.
 *     parameters:
 *       - in: query
 *         name: invoiceRef
 *         required: true
 *         schema:
 *           type: string
 *         description: The invoice reference field.
 *       - in: query
 *         name: paymentRef
 *         required: true
 *         schema:
 *           type: string
 *         description: A unique payment reference included as a memo (on-chain).
 *     responses:
 *       200:
 *         description: Invoice instance status retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string }
 *                 amountPaid: { type: number }
 *                 uiPaidAmount: { type: string }
 *                 uiTokenAmount: { type: string }
 *                 tokenSymbol: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/status', async (req, res) => {
  const { invoiceRef, paymentRef } = req.query;
  if (!invoiceRef || !paymentRef) {
    return res.status(400).json({ error: 'Invalid Request' });
  }

  // 1. Retrieve invoice details from DB
  let invoice;
  invoice = tokenWallDb.getInvoiceByRef(invoiceRef);

  if (!invoice || !invoice.cipher_iv || !invoice.script_cipher) {
    return res.status(404).json({ error: 'Not Found' });
  }

  // 2. Interpret invoice data and read payments
  const paymentAddress = invoice.paidto_address;
  const tokenAddress = invoice.token_address;
  const amountExpected = BigInt(invoice.lamports);
  const knownToken = knownTokens.find(
    t => t.mintAddress === invoice.token_address
  );
  const tokenSymbol = !!knownToken ? knownToken.name : `SPL (${shortenAddr(invoice.token_address)})`;
  const paymentsCount = tokenWallDb.getPaymentsCountByInvoiceId(invoice.id);
  let paymentsState = getInvoiceStatus(invoiceRef, paymentRef);

  let uiTokenAmount, uiPaidAmount;
  if (!!knownToken) {
    uiTokenAmount = actualTokenAmount(knownToken, invoice.lamports);
    uiPaidAmount = actualTokenAmount(knownToken, paymentsState.amountPaid);
  } else {
    let kt = { name: tokenSymbol, decimals: 9 };
    uiTokenAmount = actualTokenAmount(kt, invoice.lamports);
    uiPaidAmount = actualTokenAmount(knownToken, paymentsState.amountPaid);
  }

  // log.info(`Status discovery for ${paymentAddress}`, {
  //   invoiceRef, paymentRef,
  //   paymentsState,
  //   paymentsCount,
  // });

  // 3. Return from status endpoint as fast as possible in case the invoice is paid.
  if (paymentsState.status === 'accepted') {
    return res.status(200).json({
      status: paymentsState.status,
      amountPaid: paymentsState.amountPaid,
      uiPaidAmount,
      uiTokenAmount,
      tokenSymbol,
    });
  }

  let rpcUrl;
  if (invoice.sol_cluster.toLowerCase() === "devnet") {
    rpcUrl = 'https://api.devnet.solana.com';
  } else {
    rpcUrl = 'https://api.mainnet.solana.com';
  }

  // log.info("Status discovery using RPC: ", {
  //   invoiceRef, paymentRef,
  //   rpcUrl,
  // });

  const web3 = require('@solana/web3.js');
  const connection = new web3.Connection(rpcUrl, 'confirmed');

  // 4. Compute the token account for this payment address (ATA for token)
  const paymentAtas = await getTokenAccounts(paymentAddress, connection);
  const relevantAta = paymentAtas.find(a => a.mintAddress === invoice.token_address)?.pubKey;

  try {
    const destinationAddr = !!relevantAta ? relevantAta : paymentAddress;

    // log.info("Using destination address (ATA): ", {
    //   invoiceRef, paymentRef,
    //   payAddress: paymentAddress,
    //   ataAddress: destinationAddr,
    // });

    // 5. Get latest signatures from destination address.
    // NOTE: signatures also return memo, but do not contain amount information.
    let signatures = await connection.getSignaturesForAddress(
      new web3.PublicKey(destinationAddr), {}, 'confirmed'
    );

    // Try using the destination address instead of the ATA.
    if (!signatures.length && destinationAddr !== paymentAddress) {
      signatures = await connection.getSignaturesForAddress(
        new web3.PublicKey(paymentAddress), {}, 'confirmed'
      );
    }

    if (!signatures.length) {
      return res.status(200).json({
        status: paymentsState.status,
        amountPaid: paymentsState.amountPaid,
        uiPaidAmount,
        uiTokenAmount,
        tokenSymbol,
      });
    }

    // 6. Pre-processing, read already processed signatures.
    let preSignatures = tokenWallDb.getSignaturesByInvoiceAndRef(invoiceRef, paymentRef);

    // log.debug(`Processing signatures for ${paymentAddress}`, {
    //   invoiceRef, paymentRef,
    //   payAddress: paymentAddress,
    //   ataAddress: destinationAddr,
    //   count: signatures.length,
    //   countBefore: preSignatures.length,
    // });

    let cntSkipped = 0,
        cntProcessed  = 0;
    for (let i = 0; i < signatures.length; i++) {
      const signature = signatures[i];
      if (preSignatures.length > 0 && -1 !== preSignatures.findIndex(
        v => v === signature.signature
      )) {
        // transaction already processed.
        cntSkipped++;
        continue;
      }

      // 7. Get parsed transaction details.
      const transaction = await connection.getParsedTransaction(signature.signature);
      if (!transaction || !transaction.slot) {
        cntSkipped++;
        continue;
      }

      // log.info(`Downloaded parsed transaction with signature ${signature.signature}`, {
      //   invoiceRef, paymentRef,
      //   transaction,
      //   signature,
      // });

      // 8. Extract the received amount from transaction for token mint address.
      // NOTE: signatures also return memo, but do not contain amount information.
      const amountRcvd = extractTransactionAmount(
        paymentRef,
        signature,
        transaction,
        paymentAddress,
        tokenAddress,
      );
      if (amountRcvd <= 0n) { // NOTE: we don't want to return negative amounts from API.
        cntSkipped++;
        continue;
      }

      log.info(`Processing new incoming payment for ${paymentAddress}`, {
        invoiceRef, paymentRef,
        payAddress: paymentAddress,
        ataAddress: destinationAddr,
        amountRcvd: amountRcvd,
      });

      tokenWallDb.addPayment({
        id: `${invoice.id}-payment-${paymentsCount+1}`,
        invoiceId: invoice.id,
        invoiceRef: invoice.invoice_ref,
        paymentRef,
        amountPaid: Number(amountRcvd),
        signatures: signature.signature,
      })
      cntProcessed++;
    }

    // 9. Re-evaluate payments state after processing.
    paymentsState = getInvoiceStatus(invoiceRef, paymentRef);

    // log.info(`Status discovery completed for ${paymentAddress}`, {
    //   invoiceRef, paymentRef,
    //   cntProcessed,
    //   cntSkipped,
    //   amountExpected,
    //   paymentsState,
    // });

    if (!!knownToken) {
      uiTokenAmount = actualTokenAmount(knownToken, invoice.lamports);
      uiPaidAmount = actualTokenAmount(knownToken, paymentsState.amountPaid);
    } else {
      let kt = { name: tokenSymbol, decimals: 9 };
      uiTokenAmount = actualTokenAmount(kt, invoice.lamports);
      uiPaidAmount = actualTokenAmount(kt, paymentsState.amountPaid);
    }

    return res.status(200).json({
      status: paymentsState.status,
      amountPaid: paymentsState.amountPaid,
      uiPaidAmount,
      uiTokenAmount,
      tokenSymbol,
    });
  } catch (error) {
    log.error('Error fetching invoice status', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch status' });
  }
});

/**
 * @swagger
 * /api/v1/tokenwall/income:
 *   get:
 *     tags:
 *       - TokenWall
 *     summary: Retrieve income aggregation, grouped by token symbol.
 *     description: Retrieves income aggregation, grouped by token symbol.
 *     parameters:
 *       - in: query
 *         name: issuer
 *         required: true
 *         schema:
 *           type: string
 *         description: The Solana Wallet Address that issued invoices.
 *     responses:
 *       200:
 *         description: Total income by tokens retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       decimals: { type: number }
 *                       total: { type: number }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/income', async (req, res) => {
  try {
    const { issuer } = req.query;
    if (!issuer) {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    const incomeRows = tokenWallDb.getIncomeByTokens(issuer);
    // log.info(`Found income rows for issuer: ${issuer}`, { incomeRows });

    const tokens = []; // tokens contains total income
    for (let i = 0; i < incomeRows.length; i++) {
      const known = knownTokens.find(
        t => t.mintAddress === incomeRows[i].token_address
      );
      if (!! known) {
        tokens.push({
          name: known.name,
          decimals: known.decimals,
          total: incomeRows[i].total ?? 0,
        });
      } else {
        tokens.push({
          name: incomeRows[i].token_address,
          decimals: 9,
          total: incomeRows.total ?? 0,
        });
      }
    }

    return res.status(200).json({
      tokens: tokens,
    });
  } catch (error) {
    log.error('Error fetching income', { error });
    return res.status(500).json({ error: 'Failed to fetch income' });
  }
});

/**
 * @swagger
 * /api/v1/tokenwall/balances:
 *   get:
 *     tags:
 *       - TokenWall
 *     summary: Retrieve withdrawable token balances.
 *     description: Retrieves withdrawable token balances (MAINNET, always).
 *     parameters:
 *       - in: query
 *         name: issuer
 *         required: true
 *         schema:
 *           type: string
 *         description: The Solana Wallet Address that issued invoices.
 *     responses:
 *       200:
 *         description: Token balances retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balances:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       owner: { type: string }
 *                       total: { type: number }
 *                 tokens:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       total: { type: number }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/balances', async (req, res) => {
  try {
    let { issuer } = req.query;
    if (!issuer) {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    // log.info("Balances discovery using RPC: ", {
    //   issuer,
    //   rpcUrl,
    // });

    const web3 = require('@solana/web3.js');
    const connection = new web3.Connection('https://api.mainnet.solana.com', 'confirmed');
    const balances = await getWithdrawableTokenBalances(issuer, connection);

    const incomeByTokens = [];
    for (let i = 0; i < balances.length; i++) {
      const token = balances[i].name;
      const decimals = balances[i].decimals;

      // aggregate once per token
      if (-1 !== incomeByTokens.findIndex(t => t.name === token)) {
        continue;
      }

      const tokenBalances = balances.filter(b => b.name === token);
      const totalAmount = tokenBalances.reduce((acc, cur) => {
        return acc + Number(cur.total);
      }, 0);

      incomeByTokens.push({
        name: token,
        decimals: decimals,
        total: totalAmount,
      });
    }

    return res.status(200).json({
      balances: balances,
      tokens: incomeByTokens,
    });
  } catch (error) {
    log.error('Error fetching token balances', { error });
    return res.status(500).json({ error: 'Failed to fetch token balances' });
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
 * /api/v1/tokenwall/asset/redirect:
 *   get:
 *     tags:
 *       - TokenWall
 *     summary: Redirects to the asset (invoice object) download link.
 *     description: Redirects to the asset (invoice object) download link.
 *     responses:
 *       301:
 *         description: Redirected successfully.
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       402:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/asset/redirect', (req, res) => {
  const { objectId } = req.query;
  if (!objectId) {
    return res.status(400).json({ error: 'Invalid Request' });
  }

  // NOTE: We first retrieve the object from DB to avoid SQL injections.
  const invoiceObject = tokenWallDb.getObjectById(objectId);
  if (!invoiceObject || !invoiceObject.invoice_id) {
    return res.status(404).json({ error: 'Not Found' });
  }

  // NOTE: Fetches the invoice from the object db fields.
  const invoice = tokenWallDb.getInvoiceById(invoiceObject.invoice_id);
  if (!invoice || !invoice.cipher_iv || !invoice.script_cipher || !invoice.status) {
    return res.status(404).json({ error: 'Not Found' });
  }

  if (invoice.status !== 'accepted') {
    return res.status(402).json({ error: 'Payment Required' });
  }

  const cleartextUrl = decrypt({
    iv: invoiceObject.url_iv,
    ciphertext: invoiceObject.url_cipher
  });

  if (!cleartextUrl) {
    return res.status(500).json({ error: 'Decryption failed: unknown error' });
  }

  tokenWallDb.updateLastDownload(objectId);
  return res.redirect(301, cleartextUrl);
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

    const solanaPriceEur = await getTokenPrice('solana', 'SOL');
    const solTokenIndex = knownTokens.findIndex(t => t.name === 'SOL');
    knownTokens[solTokenIndex].priceEur = solanaPriceEur;

    const usdcPriceEur = await getTokenPrice('usd-coin', 'USDC');
    const usdcTokenIndex = knownTokens.findIndex(t => t.name === 'USDC');
    knownTokens[usdcTokenIndex].priceEur = usdcPriceEur;

    const eurcPriceEur = await getTokenPrice('euro-coin', 'EURC');
    const eurcTokenIndex = knownTokens.findIndex(t => t.name === 'EURC');
    knownTokens[eurcTokenIndex].priceEur = eurcPriceEur;

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
