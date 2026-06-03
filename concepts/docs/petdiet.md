# PetDiet - Manage Your Pet's Nutrition

Create custom nutrition plans and track your pet's daily feeding with PetDiet, a decentralized nutrition management system for pets.

## Getting Started

### 1. Connect Your Wallet

Click **"Connect Wallet"** to get started:
- Use Phantom wallet (recommended)
- Or enter your Solana account address manually

### 2. Select Your Pet

Choose a pet from the dropdown list:
- Your own registered pets appear automatically
- You can also manage pets where you're an authorized veterinarian

## Creating a Nutrition Plan

### Step 1: Plan Details

Fill in these required fields:

- **Plan Name**: Give your plan a descriptive name (e.g., "Summer Wellness Plan")
- **Start Date**: When this nutrition plan begins
- **Duration**: How long the plan lasts (choose from 2 weeks to 1 year)

### Step 2: Daily Ingredients

Enter ingredients for each day of the week:

- **Monday through Sunday**: 7 text fields for daily meals
- **Auto-fill feature**: Leave a day empty and it will automatically use the last filled day's ingredients
- **At least one day required**: You must specify ingredients for at least one day

### Step 3: Optional Authorized Nutritioner

Assign an authorized nutritioner (optional):

- Enter their Solana wallet address
- They'll be able to record feeding actions for this pet
- Both you (the owner) and the authorized nutritioner can log feedings

### Step 4: Submit

Click **"Create Nutrition Plan"** to:
1. Create SPL token mint for this nutrition plan
2. Sign the transaction with your wallet
3. Create a blockchain record of your nutrition plan with all ingredients
4. Get a unique token to represent this plan on-chain

Once created, you'll see a success message with:
- Plan ID and details
- SPL token mint address (on Solscan)
- Ingredients transaction hash (on Solscan)
- Link to verify the plan on Solscan

## Recording Feeding Actions

### How to Log a Feeding

1. Click **"🍽️ Feed Now"** on any nutrition plan card
2. The form appears with today's ingredients pre-filled (based on day of week)
3. Modify ingredients if needed (optional)
4. Click **"Sign & Submit Feeding"**
5. Sign the message with your wallet (cryptographic proof of feeding)
6. Wait for transaction confirmation

The feeding is now recorded on-chain with:
- Your signature as proof of the feeding action
- The ingredients you fed
- A timestamp of when it was recorded
- A blockchain transaction signature for verification

### Who Can Record Feedings

- **Pet Owner**: Always authorized to record feedings
- **Authorized Nutritioner**: If specified during plan creation
- **Authorization**: Verified against the plan's authorized nutritioner field

### View Feeding History

1. Click **"📋 View History"** on a nutrition plan
2. See all past feeding events in reverse chronological order
3. Each entry shows:
   - When the feeding was recorded
   - What ingredients were given
   - Who recorded it (owner address)
   - A Solscan link to verify on-chain

## Nutrition Plan Card

On the main screen, each nutrition plan shows:

- **Plan Name**: The name you gave it
- **Start Date**: When it began
- **Duration**: How long it runs (with end date)
- **Mint Address**: Click to see the SPL token on Solscan
- **Ingredients Transaction**: Click to view the complete plan details on Solscan
- **Status**: Indicators for active/archived status
- **"🍽️ Feed Now"**: Quick button to record today's feeding
- **"📋 View History"**: See all past feeding records

### Nutrition Plan Details

Each plan stores:
- Pet information (ID, name, owner)
- Plan metadata (name, start date, duration, end date)
- Weekly ingredients (Monday through Sunday with auto-fill)
- Authorized nutritioner wallet (if specified)
- SPL token mint address (proof on-chain)
- Creation timestamp and transaction hash

## Understanding Auto-Fill

When creating a plan, if you only fill some days:

**Example:**
- Monday: "Chicken, Rice, Carrots"
- Tuesday through Thursday: *empty*
- Friday: "Fish, Oats"

**Result:**
- Monday: "Chicken, Rice, Carrots"
- Tuesday: "Chicken, Rice, Carrots" (auto-filled from Monday - forward fill)
- Wednesday: "Chicken, Rice, Carrots" (auto-filled from Monday - forward fill)
- Thursday: "Chicken, Rice, Carrots" (auto-filled from Monday - forward fill)
- Friday: "Fish, Oats"
- Saturday: "Fish, Oats" (auto-filled from Friday - forward fill)
- Sunday: "Fish, Oats" (auto-filled from Friday - forward fill)

**How it works:** The system uses forward-fill logic - each empty day inherits from the last filled day. This allows for simple ingredient plans where you specify a change mid-week.

## Verification on Solscan

Every nutrition plan and feeding action is recorded on the Solana blockchain:

1. Click the **Mint Address** link to see your SPL token on Solscan
2. Click the **Ingredients Transaction** link to view the complete plan details stored on-chain
3. Click **Solscan** links on feeding actions to verify when and what was fed
4. All data is immutable and transparent on the blockchain

## Best Practices

### Creating Plans

- **Be specific with ingredients**: Include quantities when possible
- **Plan ahead**: Consider seasonal changes and nutritional needs
- **Assign nutritioners**: Delegate feeding tasks to trusted veterinarians
- **One plan at a time**: Create separate plans for different seasons or diets

### Recording Feedings

- **Log promptly**: Record feedings the same day for accuracy
- **Track deviations**: If you deviate from the plan, note what you actually fed
- **Regular checks**: Both owner and nutritioner can monitor feeding compliance
- **Review history**: Regularly check past feedings to ensure consistency

### Managing Multiple Plans

- Create different plans for different seasons
- Use plans for special diets (weight loss, allergy management)
- Archive old plans by creating new ones (plans are immutable)
- Note: Only active plan's ingredients are used for daily suggestions

## Common Questions

**Q: What if I forget to fill in some days?**
A: Empty days will automatically use the last filled day's ingredients via forward-fill logic. This allows for simplified planning where you only need to specify ingredients when they change.

**Q: Can I change a plan after creating it?**
A: Plans are immutable once created on-chain (by design for data integrity). Create a new plan if you need different ingredients.

**Q: Who can record feedings?**
A: You (the pet owner) and any authorized nutritioners you specified can record feedings. Authorization is verified against the plan's authorized nutritioner field.

**Q: Who pays for transactions?**
A: The pet owner pays for:
- Creating nutrition plans (SPL token mint + memo transaction)
- Initial feeding actions (memo transaction)

Authorized nutritioners pay for their own feeding recordings.

**Q: Are my feedings really on the blockchain?**
A: Yes! Each feeding is recorded as a transaction on the Solana blockchain. You can verify each one on Solscan using the transaction signature link.

**Q: What happens when a plan expires?**
A: Plans persist indefinitely on-chain. Create a new plan for the next period. Old plans remain as historical records.

**Q: Can multiple pets share a nutrition plan?**
A: No, each nutrition plan is linked to a specific pet. Create separate plans for each pet.

**"Phantom wallet not found"**
- Install Phantom from https://phantom.app
- Or use manual address entry as alternative
- Ensure you're using HTTPS (Phantom requires secure connection)

**"Only pet owner can create nutrition plans"**
- You must be the registered owner of the pet
- Only the pet owner's wallet can create and manage plans
- Contact the owner if you need to manage their pet's nutrition

**"Failed to create nutrition plan"**
- Ensure all required fields are filled
- At least one day of ingredients is needed
- Check your Solana wallet has sufficient balance for fees (~0.005 SOL)
- Verify you have Phantom wallet properly connected
- Check browser console for detailed error messages

**"Authorization failed for nutritioner"**
- Verify the nutritioner's wallet address is correct (32-44 base58 characters)
- Address must be a valid Solana public key
- Try clicking elsewhere and reopening the form
- Check that you're using the correct pet dropdown

**Missing pets in dropdown**
- Pets must be registered in PetTracker first
- Only pets you own appear in the list
- If you're an authorized veterinarian for a pet, it appears for nutrition plan recording
- Refresh the page to reload the pets list

**"Failed to record feeding"**
- Ensure the pet still exists in the system
- Verify you have authorization (owner or nutritioner)
- Check your wallet has sufficient SOL (~0.002 SOL per feeding)
- Ensure nutrition plan hasn't been deleted
- Check that the plan is still associated with the pet

## Need Help?

- Check the FAQ section above
- Review Solscan transaction links for details
- Ensure your Phantom wallet is properly connected with the right account

---

**PetDiet** - Bringing transparency and security to your pet's nutrition management.
