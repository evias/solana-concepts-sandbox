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

const shortenAddr = (addr) => {
  if (!addr || addr.length < 10) return addr;
  return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4)
};

const actualTokenAmount = (token, amt) => {
  const decimals = token.decimals;
  const totalAmt = amt / (Math.pow(10, decimals));
  return totalAmt.toFixed(decimals) + ' ' + token.name;
};

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

    const lib = require('sas-lib');
    const web3 = require('@solana/web3.js');
    const { createSolanaRpc } = require('@solana/kit');
    const sasIntegration = require('./sas-integration');

    // Initialize RPC connection ("fetchMaybeX").
    const rpc = createSolanaRpc('https://api.devnet.solana.com');
    const COMPUTE_BUDGET_PROGRAM = new web3.PublicKey('ComputeBudget111111111111111111111111111111');

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

    // 3. Create unique payment credential PDA per invoice. Each invoice has
    // exactly 1 credential PDA and schema, and each "payment" of the invoice
    // is done via sending tokens to the credential PDA.
    const issuerPubKey = new web3.PublicKey(issuerAddress);
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

    let credentialAccount = await lib.fetchMaybeCredential(rpc, credentialPda);
    if (!credentialAccount || credentialAccount.exists === false) {
      const kitIx = lib.getCreateCredentialInstruction({
        payer: issuerAddress,
        authority: issuerAddress,
        credential: credentialPda,
        name: credentialName,
        signers: [issuerAddress],
      });

      const createCredentialIx = new web3.TransactionInstruction({
        programId: lib.SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
        keys: [
          sasIntegration.roleToWeb3Account(issuerAddress, 3),
          sasIntegration.roleToWeb3Account(credentialPda, 1),
          sasIntegration.roleToWeb3Account(issuerAddress, 0),
          sasIntegration.roleToWeb3Account(web3.SystemProgram.programId, 0),
        ],
        data: Buffer.from(kitIx.data)
      });

      transaction.add(createCredentialIx);
    }

    let schemaAccount = await lib.fetchMaybeSchema(rpc, schemaPda);
    if (!schemaAccount || schemaAccount.exists === false) {
      const layout = Buffer.from([12, 12]); // payerAddress, paymentTxSig in string format.
      const kitIx = lib.getCreateSchemaInstruction({
        payer: issuerAddress,
        authority: issuerAddress,
        credential: credentialPda,
        schema: schemaPda,
        layout: layout,
        fieldNames: fieldNames,
        name: schemaName,
        description: 'TokenWall Payment baskets schema',
      });

      const createSchemaIx = new web3.TransactionInstruction({
        programId: lib.SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
        keys: [
          sasIntegration.roleToWeb3Account(issuerAddress, 3),
          sasIntegration.roleToWeb3Account(issuerAddress, 0),
          sasIntegration.roleToWeb3Account(credentialPda, 0),
          sasIntegration.roleToWeb3Account(schemaPda, 1),
          sasIntegration.roleToWeb3Account(web3.SystemProgram.programId, 0),
        ],
        data: Buffer.from(kitIx.data)
      });

      transaction.add(createSchemaIx);
    }

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
      paymentPda: credentialPda,
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
 *               - paymentPda
 *               - blockHash
 *               - maxBlockHeight
 *               - issuerAddress
 *               - tokenAddress
 *               - lamports
 *               - contentSelector
 *               - useCluster
 *             properties:
 *               invoiceRef:
 *                 type: string
 *                 description: The invoice reference.
 *               signedTransaction:
 *                 type: string
 *                 description: Base64 signed transaction from user's wallet.
 *               paymentPda:
 *                 type: string
 *                 description: The payment PDA for this invoice.
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
      blockHash, maxBlockHeight,
      paymentPda, invoiceRef, signedTransaction,
      issuerAddress, tokenAddress, lamports, contentSelector,
      useCluster,
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

    // const nonceInput = [paymentPda, invoiceRef].join(':');
    // const nonceHash = crypto.createHash('sha256').update(nonceInput).digest();
    // const nonceKeypair = web3.Keypair.fromSeed(new Uint8Array(nonceHash.slice(0, 32)));
    // const nonce = nonceKeypair.publicKey.toString();

    // const [attestationPda] = await lib.deriveAttestationPda({
    //   credential: credentialPda,
    //   schema: schemaPda,
    //   nonce: nonce
    // });
    // log.info('Attestation PDA derived', { attestationPda });

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
    scriptPayload = encrypt(scriptHtml); // encrypt using AES

    tw_invoices_row = tokenWallDb.createInvoice({
      id: invoiceId,
      invoiceRef,
      issuerAddress,
      tokenAddress,
      lamports,
      useCluster,
      paidtoAddress: paymentPda,
      scriptCipher: scriptPayload.ciphertext,
      scriptIV: scriptPayload.iv,
    });

    return res.status(200).json({
      success: true,
      invoiceId,
      invoiceRef,
      paymentPda,
      txSig: transactionSignature,
    });
  } catch (error) {
    log.error('Signed transaction submission error:', { error: error.message, stack: error.stack });
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
 *         required: false
 *         schema:
 *           type: string
 *         description: A unique payment reference.
 *       - in: query
 *         name: enableMeta
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Whether to include metadata.
 *     responses:
 *       200:
 *         description: Invoice retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 script: { type: string }
 *                 paymentUrl: { type: string }
 *                 qrCode: { type: string }
 *                 issuerAddress: { type: string }
 *                 tokenAddress: { type: string }
 *                 paymentAddress: { type: string }
 *                 invoiceRef: { type: string }
 *                 amountLamports: { type: number }
 *                 tokenSymbol: { type: string }
 *                 uiTokenAmount: { type: string }
 *                 lastRead: { type: string }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/invoice', async (req, res) => {
  const { invoiceRef, paymentRef, enableMeta } = req.query;
  if (!invoiceRef) {
    return res.status(402).json({ error: 'Invalid Request' });
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
    message: `Payment for invoice ${invoice.invoice_ref}`
  };
  if (invoice.token_address !== SCS_SOL_MINT_ADDRESS) {
    payParams.splToken = invoice.token_address;
  }
  if (!!paymentRef && paymentRef.length) {
    payParams.memo = paymentRef;
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

    let uiTokenAmount;
    if (!!knownToken) {
      uiTokenAmount = actualTokenAmount(knownToken, invoice.lamports);
    } else {
      let kt = { name: tokenSymbol, decimals: 9 };
      uiTokenAmount = actualTokenAmount(kt, invoice.lamports);
    }

    response = {
      paymentUrl,
      qrCode: payQrCode,
      issuerAddress: invoice.issuer_address,
      tokenAddress: invoice.token_address,
      paymentAddress: invoice.paidto_address,
      invoiceRef: invoice.invoice_ref,
      amountLamports: invoice.lamports,
      tokenSymbol: tokenSymbol,
      uiTokenAmount: uiTokenAmount,
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
 *         description: A unique payment reference.
 *     responses:
 *       200:
 *         description: Status retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 amountPaid:
 *                   type: number
 *                 tokenSymbol:
 *                   type: string
 *       402:
 *         $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/status', async (req, res) => {
  const { invoiceRef, paymentRef } = req.query;
  if (!invoiceRef || !paymentRef) {
    return res.status(402).json({ error: 'Invalid Request' });
  }

  // 1. Retrieve invoice details from DB
  let invoice;
  invoice = tokenWallDb.getInvoiceByRef(invoiceRef);

  if (!invoice || !invoice.cipher_iv || !invoice.script_cipher) {
    return res.status(404).json({ error: 'Not Found' });
  }

  let rpcUrl;
  if (invoice.sol_cluster.toLowerCase() === "devnet") {
    rpcUrl = 'https://api.devnet.solana.com';
  } else {
    rpcUrl = 'https://api.mainnet.solana.com';
  }

  const paymentAddress = invoice.paidto_address;
  const tokenAddress = invoice.token_address;
  const amountExpected = BigInt(invoice.lamports);
  const knownToken = knownTokens.find(
    t => t.mintAddress === invoice.token_address
  );
  const tokenSymbol = !!knownToken ? knownToken.name : `SPL (${shortenAddr(invoice.token_address)})`;

  const web3 = require('@solana/web3.js');
  const connection = new web3.Connection(rpcUrl, 'confirmed');

  // Manual verification for received amounts.
  // NOTE: The returned amount will be positive.
  const extractTransactionAmount = (tx, addr, mint) => {
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

  try {
    // 2. Get latest signatures from destination address.
    // NOTE: signatures also return memo, but do not contain amount information.
    const signatures = await connection.getSignaturesForAddress(
      new web3.PublicKey(paymentAddress), {}, 'confirmed',
    );
    if (!signatures.length) {
      //XXX do we want status 404, etc. here?
      return res.status(200).json({
        status: 'pending',
        amountPaid: 0,
        uiTokenAmount: `0 ${tokenSymbol}`,
        tokenSymbol,
      });
    }

    let totalReceived = BigInt(0);
    for (let i = 0; i < signatures.length; i++) {
      const signature = signatures[i];

      // 3. Get parsed transaction details.
      const transaction = await connection.getParsedTransaction(signature.signature);
      if (!transaction || !transaction.slot) {
        return res.status(200).json({
          status: 'pending',
          amountPaid: 0,
          uiTokenAmount: `0 ${tokenSymbol}`,
          tokenSymbol,
        });
      }

      // 4. Extract the received amount from transaction for token mint address.
      const amountRcvd = extractTransactionAmount(transaction, paymentAddress, tokenAddress);
      if (amountRcvd <= 0n) { // NOTE: we don't want to return negative amounts from API.
        continue;
      }

      totalReceived = totalReceived + amountRcvd;
    }

    let uiTokenAmount;
    if (!!knownToken) {
      uiTokenAmount = actualTokenAmount(knownToken, Number(totalReceived));
    } else {
      let kt = { name: tokenSymbol, decimals: 9 };
      uiTokenAmount = actualTokenAmount(kt, Number(totalReceived));
    }

    if (totalReceived < amountExpected) {
      return res.status(200).json({
        status: totalReceived > 0n ? 'partial' : 'pending',
        amountPaid: Number(totalReceived),
        uiTokenAmount,
        tokenSymbol,
      });
    }

    return res.status(200).json({
      status: 'accepted',
      amountPaid: Number(totalReceived),
      uiTokenAmount,
      tokenSymbol,
    });
  } catch (error) {
    log.error('Error fetching invoice status', { error });
    return res.status(500).json({ error: 'Failed to fetch status' });
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
