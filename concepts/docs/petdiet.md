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

### Step 3: Optional Nutritioner

Assign an authorized nutritioner (optional):

- Enter their Solana wallet address
- They'll be able to record feeding actions for this pet

### Step 4: Submit

Click **"Create Nutrition Plan"** to:
1. Sign the transaction with your wallet
2. Create a blockchain record of your nutrition plan
3. Get a unique token to represent this plan on-chain

Once created, you'll see a success message with a link to verify the plan on Solscan.

## Recording Feeding Actions

### How to Log a Feeding

1. Click **"🍽️ Feed Now"** on any nutrition plan card
2. The form appears with today's ingredients pre-filled
3. Modify ingredients if needed (optional)
4. Click **"Sign & Submit Feeding"**
5. Sign the message with your wallet (cryptographic proof)
6. Wait for transaction confirmation

The feeding is now recorded on-chain with:
- Your signature as proof
- The ingredients you fed
- A timestamp
- A blockchain transaction link for verification

### View Feeding History

1. Click **"📋 View History"** on a nutrition plan
2. See all past feeding events in reverse chronological order
3. Each entry shows:
   - When the feeding was recorded
   - What ingredients were given
   - A Solscan link to verify on-chain

## Nutrition Plan Card

On the main screen, each nutrition plan shows:

- **Plan Name**: The name you gave it
- **Start Date**: When it began
- **Duration**: How long it runs
- **Mint Address**: Click to see the SPL token on Solscan
- **Ingredients Transaction**: Click to view the complete plan details on Solscan
- **"🍽️ Feed Now"**: Quick button to record today's feeding
- **"📋 View History"**: See all past feeding records

## Understanding Auto-Fill

When creating a plan, if you only fill some days:

**Example:**
- Monday: "Chicken, Rice, Carrots"
- Tuesday through Thursday: *empty*
- Friday: "Fish, Oats"

**Result:**
- Monday: "Chicken, Rice, Carrots"
- Tuesday: "Chicken, Rice, Carrots" (auto-filled from Monday)
- Wednesday: "Chicken, Rice, Carrots" (auto-filled from Monday)
- Thursday: "Chicken, Rice, Carrots" (auto-filled from Monday)
- Friday: "Fish, Oats"
- Saturday: "Fish, Oats" (auto-filled from Friday)
- Sunday: "Fish, Oats" (auto-filled from Friday)

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

### Recording Feedings

- **Log promptly**: Record feedings the same day for accuracy
- **Track deviations**: If you deviate from the plan, note what you actually fed
- **Review history**: Regularly check past feedings to ensure consistency

### Managing Multiple Plans

- Create different plans for different seasons
- Use plans for special diets (weight loss, allergy management)
- Keep archived plans for reference

## Common Questions

**Q: What if I forget to fill in some days?**
A: Empty days will automatically use the last filled day's ingredients. This allows for simplified planning.

**Q: Can I change a plan after creating it?**
A: Plans are immutable once created on-chain. Create a new plan if you need different ingredients.

**Q: Who can record feedings?**
A: You (the pet owner) and any authorized nutritioners you specified can record feedings.

**Q: Are my feedinges really on the blockchain?**
A: Yes! Each feeding is recorded as a transaction on the Solana blockchain. You can verify each one on Solscan.

**Q: What happens when a plan expires?**
A: Plans persist indefinitely. Create a new plan for the next period.

## Troubleshooting

**"Phantom wallet not found"**
- Install Phantom from https://phantom.app
- Or use manual address entry as alternative

**"Only pet owner can create nutrition plans"**
- You must be the registered owner of the pet
- Contact the owner if you need to manage their pet's nutrition

**"Failed to create nutrition plan"**
- Ensure all required fields are filled
- At least one day of ingredients is needed
- Check your Solana wallet has sufficient balance for fees

**Missing pets in dropdown**
- Pets must be registered in PetTracker first
- Only pets you own or are authorized for appear

## Need Help?

- Check the FAQ section above
- Review Solscan transaction links for details
- Ensure your Phantom wallet is properly connected with the right account

---

**PetDiet** - Bringing transparency and security to your pet's nutrition management.
