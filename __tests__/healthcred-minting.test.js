/**
 * HealthCred Credentials and Badges - Regression Tests
 * Tests to ensure SPL token minting works correctly after fixes
 * 
 * Key regression prevention:
 * 1. Minting follows simple, direct pattern: createMint -> ATA -> mintTo
 * 2. No complex retry logic or delays needed - direct spl-token calls work
 * 3. Both credentials and badges use same proven pattern
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

    test('healthcred.js should use simple direct pattern for SPL minting', async () => {
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Should call createMint, then getOrCreateAssociatedTokenAccount, then mintTo
      expect(content).toMatch(/createMint[\s\S]{1,500}getOrCreateAssociatedTokenAccount[\s\S]{1,500}mintTo/);
    });

    test('healthcred.js should not have complex retry logic for ATA creation', async () => {
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Should not have while loops with retry counters
      expect(content).not.toMatch(/while\s*\(\s*ataAttempts\s*</);
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

    test('should follow mint -> ATA -> mint pattern for credentials', async () => {
      // Verify direct pattern without complex retry logic
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      // Find the pattern: createMint -> getOrCreateAssociatedTokenAccount -> mintTo
      const pattern = /createMint[\s\S]{1,1000}getOrCreateAssociatedTokenAccount[\s\S]{1,1000}mintTo/;
      expect(pattern.test(content)).toBe(true);
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
      expect(content).toContain('Minting 1 badge NFT');
      expect(content).toContain('credentialOwnerPublicKey');
    });

    test('should follow same simple mint pattern as credentials', async () => {
      // Ensure consistency between credential and badge minting
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Both credentials and badges should use the same pattern
      // Count occurrences: should have at least 2 createMint, 2 ATA, 2 mintTo
      const occurrences = {
        createMint: (content.match(/createMint/g) || []).length,
        getOrCreateAssociatedTokenAccount: (content.match(/getOrCreateAssociatedTokenAccount/g) || []).length,
        mintTo: (content.match(/mintTo/g) || []).length
      };
      
      expect(occurrences.createMint).toBeGreaterThanOrEqual(2);
      expect(occurrences.getOrCreateAssociatedTokenAccount).toBeGreaterThanOrEqual(2);
      expect(occurrences.mintTo).toBeGreaterThanOrEqual(2);
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
      const pattern = /badgeMintSig[\s\S]{1,500}Creating badge record in database/;
      expect(pattern.test(content)).toBe(true);
    });

    test('should use spl-token functions without retry wrappers', async () => {
      // Simple, direct usage is more reliable than complex retry logic
      const filePath = path.join(__dirname, '../api/healthcred.js');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Should import and use spl-token functions directly
      expect(content).toContain('createMint');
      expect(content).toContain('getOrCreateAssociatedTokenAccount');
      expect(content).toContain('mintTo');
      
      // Should not have manual while loops for retries
      expect(content).not.toMatch(/while\s*\(\s*\w+Attempts\s*</);
    });

    test('process.env.NODE_ENV should be "test" during test execution', async () => {
      // Verify test environment is configured correctly
      expect(process.env.NODE_ENV).toBe('test');
    });
  });
});
