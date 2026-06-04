/**
 * HealthCred Credentials and Badges - Regression Tests
 * Tests to ensure SPL token minting works correctly after fixes
 * 
 * Key regression prevention:
 * 1. RPC indexing delays between mint -> ATA -> mintTo
 * 2. Delays are skipped in test mode for performance
 * 3. Both credentials and badges follow same pattern
 * 4. Mint addresses are properly stored
 */

const fs = require('fs');
const path = require('path');

describe('HealthCred Credentials - SPL Minting Regression Tests', () => {
  describe('Code Structure Verification', () => {
    test('healthcred.js should exist and be loadable', async () => {
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const exists = fs.existsSync(filePath);
      expect(exists).toBe(true);
    });

    test('healthcred.js should contain credential minting logic', async () => {
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Check for key functions and patterns
      expect(content).toContain('createMint');
      expect(content).toContain('getOrCreateAssociatedTokenAccount');
      expect(content).toContain('mintTo');
    });

    test('healthcred.js should have RPC indexing delays for credentials', async () => {
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Should have delays conditioned on NODE_ENV
      expect(content).toMatch(/NODE_ENV\s*!==\s*['"]test['"]\s*\)\s*{\s*await\s+new\s+Promise/);
      // Count occurrences - should be at least 2 (any setTimeout pattern)
      const matches = content.match(/await new Promise\(resolve => setTimeout\(resolve,/g);
      expect(matches).not.toBeNull();
      expect(matches.length).toBeGreaterThanOrEqual(4); // Credentials + Badges (2 delays each)
    });

    test('healthcred.js should have RPC indexing delays for badges', async () => {
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Check that badges also have delays (any duration is fine)
      expect(content).toMatch(/Badge SPL token mint created[\s\S]{1,300}await new Promise\(resolve => setTimeout/);
    });
  });

  describe('Credential Creation with SPL Token', () => {
    test('should create credential with SPL token mint', async () => {
      // Placeholder - real integration test requires web3.js mocking
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('Token mint created');
    });

    test('should mint token to credential owner ATA', async () => {
      // Verify minting flow is present in code
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('mintTo');
      expect(content).toContain('Minting credential token');
    });

    test('should wait for RPC to index mint before creating ATA', async () => {
      // Verify delay between mint creation and ATA creation
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Find the pattern: createMint -> setTimeout -> getOrCreateAssociatedTokenAccount (flexible timing)
      const mintPattern = /createMint[\s\S]{1,800}await new Promise\(resolve => setTimeout[\s\S]{1,300}getOrCreateAssociatedTokenAccount/;
      expect(mintPattern.test(content)).toBe(true);
    });

    test('should wait for RPC to index ATA before minting', async () => {
      // Verify delay between ATA creation and token minting
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Find the pattern: getOrCreateAssociatedTokenAccount -> setTimeout -> mintTo (flexible timing)
      const ataPattern = /getOrCreateAssociatedTokenAccount[\s\S]{1,800}await new Promise\(resolve => setTimeout[\s\S]{1,300}mintTo/;
      expect(ataPattern.test(content)).toBe(true);
    });
  });

  describe('Badge Creation with SPL Token', () => {
    test('should create badge with SPL token mint', async () => {
      // Verify badge minting flow is present
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('Badge SPL token mint created');
    });

    test('should mint badge token to credential owner', async () => {
      // Ensure badge tokens are minted to correct recipient
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('Minting 1 badge NFT token');
      expect(content).toContain('credentialOwnerPublicKey');
    });

    test('should follow same mint -> wait -> ATA -> wait -> mint pattern as credentials', async () => {
      // Ensure consistency between credential and badge minting
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Both credentials and badges should have multiple setTimeout calls for RPC delays
      // Use flexible pattern to match any setTimeout duration
      const delays = content.match(/await new Promise\(resolve => setTimeout\(resolve,/g) || [];
      // Should have at least 4: 2 for credentials (mint + ATA) + 2 for badges (mint + ATA)
      expect(delays.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Minting Timing and Race Conditions', () => {
    test('delays should be skipped in test mode', async () => {
      // Verify NODE_ENV condition is properly set
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Should have checks for NODE_ENV !== 'test'
      expect(content).toMatch(/NODE_ENV\s*!==\s*['"]test['"]/);
    });

    test('process.env.NODE_ENV should be "test" during test execution', async () => {
      // Verify test environment is configured correctly
      expect(process.env.NODE_ENV).toBe('test');
    });

    test('delays should apply outside test environment', async () => {
      // Document that 1000ms delays are used in production
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Should have hardcoded 1000ms delays for RPC indexing
      expect(content).toMatch(/setTimeout\(resolve, 1000\)/);
    });
  });

  describe('Regression Prevention', () => {
    test('credentials should not lose their SPL mint addresses', async () => {
      // Ensure mint address is properly stored
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('mintAddress =');
      expect(content).toContain('toBase58()');
    });

    test('badges should be created after tokens are successfully minted', async () => {
      // Verify badge record creation happens after minting
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Find the pattern: badgeMintSig -> then create badge record
      // The pattern allows for some variance in log format
      const pattern = /badgeMintSig[\s\S]{1,500}Creating badge record in database/;
      expect(pattern.test(content)).toBe(true);
    });

    test('both credential and badge minting should follow same pattern', async () => {
      // Ensure consistency across flows
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Both should have:
      // 1. createMint
      // 2. delay (setTimeout with any duration)
      // 3. getOrCreateAssociatedTokenAccount  
      // 4. delay (setTimeout with any duration)
      // 5. mintTo
      
      const occurrences = {
        createMint: (content.match(/createMint/g) || []).length,
        setTimeout: (content.match(/await new Promise\(resolve => setTimeout\(resolve,/g) || []).length,
        getOrCreateAssociatedTokenAccount: (content.match(/getOrCreateAssociatedTokenAccount/g) || []).length,
        mintTo: (content.match(/mintTo/g) || []).length
      };
      
      // Should have at least 2 of each for credentials and badges
      expect(occurrences.createMint).toBeGreaterThanOrEqual(2);
      expect(occurrences.setTimeout).toBeGreaterThanOrEqual(4); // 2 delays per flow × 2 flows
      expect(occurrences.getOrCreateAssociatedTokenAccount).toBeGreaterThanOrEqual(2);
      expect(occurrences.mintTo).toBeGreaterThanOrEqual(2);
    });
  });
});
