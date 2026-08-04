# TokenWall - Paid Content: Token Invoices

TokenWall enables creators and service providers to monetize content by creating payment invoices on the Solana blockchain. Users pay in any supported SPL token (SOL, USDC, EURC, DHP, AIDH) to unlock downloadable assets or access restricted content.

## Getting Started

### 1. Fund Your Wallet

You need SOL on your chosen Solana cluster to create invoices (approximately 0.005 SOL per invoice for transaction fees).

1. Connect your wallet via Phantom
2. For **Devnet**: Go to https://faucet.solana.com and paste your wallet address
3. For **Mainnet**: Transfer SOL from an exchange to your wallet

### 2. Connect Your Wallet

1. Click "Connect Wallet"
2. Select Phantom wallet
3. Approve the connection
4. (Optional) Manually enter a wallet address if not using Phantom

### 3. Create an Invoice

Creating an invoice is a 2-step process:

#### Step 1: Prepare Invoice
1. Choose your target cluster: **Mainnet** (production) or **Devnet** (testing)
2. Select a **Token** to receive payment (SOL, USDC, EURC, or others you own)
3. Enter the **Amount in Lamports** (smallest unit of the token):
   - The UI will show the equivalent amount in the token's readable units
   - Approximate EUR price will be displayed (when available)
4. (Optional) Enable **Downloadable Assets** and configure:
   - Asset type (Image, Audio, Video, Text, PDF, ZIP)
   - Asset URL (link where customers will download from)
   - Add multiple assets per invoice
5. Click "Create Invoice"
6. Approve the transaction in Phantom (you pay for the transaction)

#### Step 2: Share and Monitor
1. After signing, you'll receive:
   - An **Invoice Reference** (unique ID)
   - An **Invoice URL** (shareable link for customers)
   - An **Embedded Script** (code to embed on your website)
2. Copy the URL and share it with customers
3. Or copy the script and embed it in your website to display the payment request

## Features

### Invoice Management

**Create Payment Requests**
- Generate invoices denominated in any supported SPL token
- Set exact payment amounts in token lamports
- Real-time price conversion to EUR for pricing reference
- Support for Solana Devnet (testing) and Mainnet (production)

**Downloadable Assets**
- Attach one or more digital assets per invoice
- Configure MIME types for different asset categories
- Asset URLs are encrypted in the database
- Automatic access unlocking after payment confirmation

**Inline Payment Widget**
- Embed TokenWall script on any website
- Displays payment details with Solana Pay QR code
- Shows payment status in real-time
- Automatically redirects to asset download on payment completion

### Invoice Tracking

**Invoice Dashboard**
- View all created invoices in a paginated list
- See invoice reference, destination wallet, token type, and amount
- Track number of assets and payments per invoice
- View creation date for each invoice

**Income Monitoring**
- Aggregate total income grouped by token type
- Display running totals for all received tokens
- Quick overview of revenue streams

**Payment Verification**
- Real-time payment status updates:
  - **Pending**: No payment received yet
  - **Partial**: Payment received but below requested amount
  - **Accepted**: Full payment received
- Track individual payment transactions with on-chain signatures
- View payment amounts and confirmation counts

### Asset Management

**Add Assets Later**
- Create invoices without assets
- Add downloadable assets after invoice creation
- Modify asset offerings without recreating invoices

**Secure Access**
- Assets locked behind payment verification
- Only paid customers can access download links
- Automatic redirect to asset on payment confirmation
- Payment status checked before granting access

### On-Chain Features

**Solana Pay Integration**
- Generate Solana Pay URLs for standard wallet payment
- Create QR codes for mobile wallet payment
- Support for SPL token transfers
- Payment memo includes invoice reference for reconciliation

**Payment Tracking**
- Transactions recorded on blockchain with invoice reference
- Payment verification by checking on-chain signatures
- Automatic memo field for payment reconciliation
- Full audit trail of all payments

## Supported Tokens

- **SOL**: Solana's native token (9 decimals)
- **USDC**: USD Coin (6 decimals)
- **EURC**: Euro Coin (6 decimals)
- **DHP**: Healthcare Token (9 decimals)
- **AIDH**: AI Health Token (6 decimals)

## How to Use

### For Content Creators

1. **Create Invoice**:
   - Click "Connect Wallet" and approve Phantom
   - Choose token and amount
   - Add downloadable assets (optional)
   - Sign transaction in Phantom

2. **Share Payment Link**:
   - Copy the invoice URL generated after creation
   - Share via email, social media, or messaging
   - Customers can open link and pay directly

3. **Embed on Website**:
   - Copy the provided script code
   - Paste into your website's HTML footer or target page
   - Script automatically displays payment widget
   - Script unlocks paid content when payment is processed

4. **Monitor Payments**:
   - Dashboard shows all invoices and payment status
   - Track total income per token

## Troubleshooting

### Cannot create invoice - insufficient funds
Fund your wallet with SOL at https://faucet.solana.com (Devnet) or via an exchange (Mainnet). You need approximately 0.005 SOL per invoice.

### Phantom won't connect
Ensure you're using an HTTPS connection (required by Phantom). Clear browser cache and try again.

### Invoice created but no script appeared
The script is generated after successful transaction. Check that:
1. The transaction was confirmed in Phantom
2. You didn't close the modal too quickly
3. Try refreshing the page and viewing invoice details

### Cannot see latest invoices
Click "Collapse" and then "Expand" on the invoices section to refresh the list. Or refresh the page to reload data.

### Payment not recognized
Payment verification can take 15-30 seconds. The system checks Solana blockchain signatures automatically. Ensure:
1. Payment was sent to the correct wallet address
2. Payment amount matches the invoice amount
3. Payment memo includes the invoice reference
4. You're on the same network (Mainnet vs Devnet)

### Asset download link not working
Ensure:
1. Payment was fully accepted (status shows "accepted")
2. Asset URL is valid and accessible
3. You have permission to access the asset URL
4. The URL didn't change after invoice creation

### Cannot add more assets to invoice
Only invoices with successfully created payment transactions can have assets added. Ensure the invoice creation transaction was signed and confirmed.

### QR code not displaying
Try:
1. Refreshing the page
2. Checking your internet connection
3. Using a different device or browser
4. Manually copying the payment URL instead of scanning QR code

### Incorrect token price display
Token prices are fetched from market data. If prices are missing:
1. Refresh the page to reload market data
2. For custom SPL tokens, price data may not be available
3. Reference official price sources for accurate pricing

### Cannot embed script on website
The script requires:
1. Valid invoice reference
2. Content selector element (CSS selector) that exists on your page
3. Script tags must be in HTML body or footer
4. Check browser console for errors: Press F12 and check Console tab

## Advanced: Website Integration

### Embedding TokenWall on Your Website

To restrict access to content based on payment:

1. **Create Invoice** on TokenWall dashboard
2. **Click View button** to see your **TokenWall Code** (script)
2. **Add script to Website HTML**
3. **Mark Content as Paid**:

```html
<body>
  <h2>Exclusive Content</h2>
  <p>This content requires payment to access.</p>
  <!-- Your premium content here -->
</body>
```

The script will:
- Lock the `body` element
- Display a payment widget overlay
- Unlock content after successful payment
- Persist unlock status in browser storage

### Payment Status Endpoints

Check payment status programmatically:

```javascript
const response = await fetch(
  '/api/v1/tokenwall/status?invoiceRef=ABC123&paymentRef=UNIQUE123'
);
const status = await response.json();
// status.status: 'pending', 'partial', or 'accepted'
// status.amountPaid: total paid in lamports
```

## On-Chain Data

All TokenWall data is recorded on Solana:

- **Invoice PDA**: Payment Derived Address for each invoice
- **Memo Transactions**: Invoice reference stored in transaction memos
- **Compute Budget**: Set to 50k compute units per invoice creation
- **Token Transfers**: SPL token transfers recorded on-chain
- **Payment Signatures**: All payment transactions verifiable via Solscan

## Security & Privacy

- **Asset URL Encryption**: Download links encrypted in database with AES-256
- **Wallet Authorization**: Only invoice creator can view dashboard and manage invoices
- **Payment Verification**: On-chain verification ensures legitimate payments
- **No Recurring Charges**: One-time payment per invoice per wallet
- **Immutable Records**: All payments recorded permanently on blockchain

## Limitations

- **Devnet/Mainnet Selection**: Invoices tied to single network, cannot mix
- **One Token Per Invoice**: Each invoice denominated in single token
- **File Storage**: Asset URLs must be externally hosted (not stored on platform)
- **Payment Finality**: Requires blockchain confirmation before asset unlock
- **Cluster Switching**: Switching between Mainnet and Devnet requires new invoice

## Technical Details

- **Solana Network**: Devnet for testing, Mainnet for production
- **Token Mints**: SOL (native), USDC, EURC, DHP, AIDH
- **RPC Endpoint**: Uses confirmed commitment level for reliability
- **Payment Detection**: Monitors wallet for incoming transactions with memo
- **Encryption**: AES-256-CBC for asset URLs stored in database
- **Memo Program**: `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`

## FAQ

**Q: What if someone sends wrong amount?**
A: Partial payments are tracked as "partial" status. Full refunds must be handled manually via wallet transfers.

**Q: Can I change the price after creating an invoice?**
A: No, invoices are immutable. Create a new invoice with the updated price.

**Q: How long do customers have to pay?**
A: Invoices don't expire. Customers can pay at any time. However, they must include the payment reference in memo for verification.

**Q: What currencies can I receive payment in?**
A: Any SPL token on your chosen cluster. Pre-configured tokens: SOL, USDC, EURC, DHP, AIDH.

**Q: Can I withdraw my earnings?**
A: Yes, earnings are held in the payment wallet address. Withdraw via any Solana wallet that supports SPL token transfers.

**Q: Is there a transaction fee?**
A: Yes, standard Solana network fees apply (~0.00025 SOL per transaction). Customers pay this fee in addition to the invoice amount when making payment.

**Q: Can multiple people pay the same invoice?**
A: Yes, each unique wallet can pay the same invoice once. The system tracks individual payments via payment references.

**Q: What happens if customer loses download link?**
A: Customer needs to pay again or request re-download from creator. Consider embedding the script on website for persistent access.
