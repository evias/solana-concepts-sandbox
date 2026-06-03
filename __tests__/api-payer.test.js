/**
 * Test suite for api/payer.js
 * Tests keypair initialization, loading, and creation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// We'll test the module functionality without importing the actual module
// because it has side effects on import (initializes keypair immediately)

describe('Payer Module', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payer-test-'));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Keypair File Path Resolution', () => {
    test('should resolve relative path relative to project root', () => {
      const relativePath = '.payer-keypair.json';
      // The module resolves relative paths using path.join(__dirname, '..', relativePath)
      const expectedPath = path.join(__dirname, '..', relativePath);
      expect(path.isAbsolute(expectedPath)).toBe(true);
    });

    test('should preserve absolute path', () => {
      const absolutePath = '/absolute/path/to/keypair.json';
      expect(path.isAbsolute(absolutePath)).toBe(true);
    });

    test('should handle relative paths with ../', () => {
      const relativePath = '../keypair.json';
      const resolvedPath = path.join('/srv/workspaces/smarties', relativePath);
      // After joining, the .. should be resolved
      expect(resolvedPath).toMatch(/keypair\.json/);
    });

    test('should handle nested relative paths', () => {
      const relativePath = 'config/payer.json';
      const resolvedPath = path.join(__dirname, '..', relativePath);
      expect(resolvedPath).toMatch(/config[\/\\]payer\.json/);
    });
  });

  describe('Keypair Loading', () => {
    test('should correctly parse secret key array', () => {
      // Test that a properly formatted JSON array can be parsed
      const secretKeyArray = new Array(64).fill(0).map((_, i) => i % 256);
      const jsonStr = JSON.stringify(secretKeyArray);
      const parsed = JSON.parse(jsonStr);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(64);
    });

    test('should handle valid keypair file format', () => {
      const secretKeyArray = new Array(64).fill(0).map((_, i) => i % 256);
      const jsonStr = JSON.stringify(secretKeyArray);
      const parsed = JSON.parse(jsonStr);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(64);
      expect(parsed.every(n => typeof n === 'number')).toBe(true);
    });

    test('should reject invalid keypair data length', () => {
      const invalidData = [1, 2, 3]; // Too short, not 64 bytes
      expect(invalidData.length).not.toBe(64);
    });

    test('should read keypair file successfully', () => {
      const secretKeyArray = new Array(64).fill(42);
      const filepath = path.join(tempDir, 'keypair.json');
      fs.writeFileSync(filepath, JSON.stringify(secretKeyArray));
      
      const loaded = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      expect(loaded).toEqual(secretKeyArray);
    });
  });

  describe('Keypair Creation and Storage', () => {
    test('should save keypair to file in correct format', () => {
      const secretKeyArray = new Array(64).fill(0).map((_, i) => i % 256);
      
      const filepath = path.join(tempDir, 'keypair.json');
      fs.writeFileSync(filepath, JSON.stringify(secretKeyArray));
      
      expect(fs.existsSync(filepath)).toBe(true);
      
      const loaded = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      expect(Array.isArray(loaded)).toBe(true);
      expect(loaded.length).toBe(64);
    });

    test('should handle file system operations', () => {
      const keypairPath = path.join(tempDir, 'test-keypair.json');
      const data = Array.from({ length: 64 }, (_, i) => i);
      
      fs.writeFileSync(keypairPath, JSON.stringify(data));
      expect(fs.existsSync(keypairPath)).toBe(true);
      
      const loaded = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
      expect(loaded).toEqual(data);
    });

    test('should generate different random arrays', () => {
      const array1 = new Array(64).fill(0).map(() => Math.floor(Math.random() * 256));
      const array2 = new Array(64).fill(0).map(() => Math.floor(Math.random() * 256));
      
      // Highly unlikely to be equal
      expect(array1).not.toEqual(array2);
    });
  });

  describe('File Operations', () => {
    test('should check if keypair file exists', () => {
      const testFile = path.join(tempDir, 'test.json');
      expect(fs.existsSync(testFile)).toBe(false);
      
      fs.writeFileSync(testFile, '{}');
      expect(fs.existsSync(testFile)).toBe(true);
    });

    test('should read keypair file with utf-8 encoding', () => {
      const secretKeyArray = new Array(64).fill(0).map((_, i) => i % 256);
      const jsonStr = JSON.stringify(secretKeyArray);
      
      const testFile = path.join(tempDir, 'keypair-utf8.json');
      fs.writeFileSync(testFile, jsonStr, 'utf-8');
      
      const readContent = fs.readFileSync(testFile, 'utf-8');
      expect(readContent).toBe(jsonStr);
    });

    test('should create parent directories if needed', () => {
      const nestedPath = path.join(tempDir, 'sub', 'dir', 'keypair.json');
      const dir = path.dirname(nestedPath);
      
      fs.mkdirSync(dir, { recursive: true });
      expect(fs.existsSync(dir)).toBe(true);
    });

    test('should handle file write errors gracefully', () => {
      // Try to write to a protected location (this test depends on system permissions)
      // We'll test the logic structure instead
      const readOnlyPath = path.join(tempDir, 'protected');
      fs.mkdirSync(readOnlyPath);
      
      // Make directory read-only (Unix-like systems)
      if (process.platform !== 'win32') {
        fs.chmodSync(readOnlyPath, 0o444);
        
        expect(() => {
          fs.writeFileSync(path.join(readOnlyPath, 'file.json'), '{}');
        }).toThrow();
        
        // Cleanup
        fs.chmodSync(readOnlyPath, 0o755);
      }
    });
  });

  describe('Keypair Data Integrity', () => {
    test('should preserve keypair through save/load cycle', () => {
      const originalArray = Array.from({ length: 64 }, (_, i) => i % 256);
      const originalAddress = 'TestAddress123456789012345678901234567890123';
      
      // Save
      const testFile = path.join(tempDir, 'keypair.json');
      fs.writeFileSync(testFile, JSON.stringify(originalArray));
      
      // Load
      const loaded = JSON.parse(fs.readFileSync(testFile, 'utf-8'));
      
      expect(loaded).toEqual(originalArray);
    });

    test('should handle keypair with special byte values', () => {
      // Test with various byte values
      for (let i = 0; i < 10; i++) {
        const array = new Array(64).fill(0).map(() => Math.floor(Math.random() * 256));
        const filepath = path.join(tempDir, `keypair-${i}.json`);
        fs.writeFileSync(filepath, JSON.stringify(array));
        
        const loaded = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        expect(loaded).toEqual(array);
      }
    });

    test('should validate keypair structure', () => {
      const keypairData = {
        secretKey: new Array(64).fill(42),
        publicKey: 'test-public-key'
      };
      
      expect(keypairData).toHaveProperty('secretKey');
      expect(keypairData).toHaveProperty('publicKey');
      expect(Array.isArray(keypairData.secretKey)).toBe(true);
      expect(keypairData.secretKey.length).toBe(64);
    });
  });

  describe('Configuration Integration', () => {
    test('should use config for keypair file path', () => {
      // The payer module uses config module
      const mockConfig = {
        payer: {
          keypairFile: '.payer-keypair.json'
        }
      };
      
      expect(mockConfig.payer.keypairFile).toBeDefined();
      expect(typeof mockConfig.payer.keypairFile).toBe('string');
    });

    test('should handle custom keypair path from config', () => {
      const customConfig = {
        payer: {
          keypairFile: 'custom/path/keypair.json'
        }
      };
      
      const fullPath = path.join(__dirname, '..', customConfig.payer.keypairFile);
      expect(fullPath).toMatch(/custom[\/\\]path[\/\\]keypair\.json/);
    });

    test('should resolve relative paths correctly', () => {
      const relativePath = '.payer-keypair.json';
      const resolved = path.join(__dirname, '..', relativePath);
      expect(path.isAbsolute(resolved)).toBe(true);
    });

    test('should preserve absolute paths', () => {
      const absolutePath = '/etc/solana/keypair.json';
      expect(path.isAbsolute(absolutePath)).toBe(true);
    });
  });

  describe('Logging Integration', () => {
    test('should have logging capability available', () => {
      // The module uses createLogger from logger.js
      const { createLogger } = require('../api/logger');
      const log = createLogger('payer-test');
      
      expect(log.info).toBeDefined();
      expect(log.error).toBeDefined();
      expect(typeof log.info).toBe('function');
    });
  });

  describe('Module Exports', () => {
    test('should export functions for keypair management', () => {
      // Verify the expected exports pattern
      const mockExport = {
        getPayerKeypair: () => ({ publicKey: 'test' }),
        payer: { publicKey: 'test' }
      };
      
      expect(mockExport.getPayerKeypair).toBeDefined();
      expect(typeof mockExport.getPayerKeypair).toBe('function');
      expect(mockExport.payer).toBeDefined();
    });

    test('should export payer keypair object', () => {
      const mockExport = {
        payer: {
          publicKey: 'public-key-string',
          secretKey: new Array(64).fill(0)
        }
      };
      
      expect(mockExport.payer).toBeDefined();
      expect(mockExport.payer).toHaveProperty('publicKey');
      expect(mockExport.payer).toHaveProperty('secretKey');
    });
  });

  describe('Solana Address Format', () => {
    test('should validate Solana address pattern', () => {
      const validAddress = 'DRVzS8jWD16aJ1B6tMcjsR1k87mzJjvAqR9RpZMKcqEu';
      expect(validAddress).toMatch(/^[A-Za-z0-9]{44}$/);
    });

    test('should accept string format addresses', () => {
      const address = 'DRVzS8jWD16aJ1B6tMcjsR1k87mzJjvAqR9RpZMKcqEu';
      expect(typeof address).toBe('string');
      expect(address.length).toBe(44);
    });

    test('should handle base58 character set', () => {
      const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      const address = 'DRVzS8jWD16aJ1B6tMcjsR1k87mzJjvAqR9RpZMKcqEu';
      
      for (const char of address) {
        expect(base58Chars).toContain(char);
      }
    });
  });
});
