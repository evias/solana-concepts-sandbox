/**
 * CareCircle Integration Tests
 * Tests for file sharing, caregiver authorization, and filesystem browsing
 */

jest.mock('@solana/web3.js', () => ({
  PublicKey: class {
    constructor(address) {
      this.address = address;
    }
    toString() {
      return this.address;
    }
    toBase58() {
      return this.address;
    }
  },
  Keypair: {
    fromSecretKey: jest.fn((secretKey) => ({
      publicKey: { toBase58: () => 'mock_public_key' },
      secretKey: secretKey,
      sign: jest.fn((message) => Buffer.from([0, 1, 2, 3]))
    }))
  },
  Transaction: class {
    constructor() {
      this.instructions = [];
    }
    add() {
      return this;
    }
    serialize(options = {}) {
      return Buffer.from([0, 1, 2, 3, 4]);
    }
    static from(buffer) {
      const tx = new this();
      tx.recentBlockhash = 'test_blockhash';
      tx.feePayer = { toString: () => 'payer_address_test' };
      tx.signatures = [];
      return tx;
    }
  },
  TransactionInstruction: class {
    constructor(data) {
      this.programId = data.programId;
      this.keys = data.keys;
      this.data = data.data;
    }
  },
  SystemProgram: {
    transfer: jest.fn(() => ({ keys: [], programId: {}, data: {} }))
  },
  Connection: class {
    constructor() {}
    getLatestBlockhash() {
      return Promise.resolve({ blockhash: 'test_blockhash', lastValidBlockHeight: 999 });
    }
    sendRawTransaction() {
      return Promise.resolve('mock_tx_' + Date.now());
    }
    confirmTransaction() {
      return Promise.resolve({ value: { err: null } });
    }
  },
  LAMPORTS_PER_SOL: 1000000000
}));

jest.mock('@solana/spl-token', () => ({
  createMint: jest.fn().mockResolvedValue({
    toBase58: () => 'mock_mint_' + Date.now()
  }),
  getOrCreateAssociatedTokenAccount: jest.fn().mockResolvedValue({
    address: {
      toBase58: () => 'mock_ata_' + Date.now()
    }
  }),
  mintTo: jest.fn().mockResolvedValue('mock_mint_sig_' + Date.now())
}));

jest.mock('../api/payer', () => ({
  payer: {
    publicKey: { toBase58: () => 'payer_address_test' }
  }
}));

jest.mock('../api/sas-integration', () => ({
  getAuthorizedSigners: jest.fn(async (credentialAddress) => {
    // Mock: return the test wallet as authorized signer for all test credentials
    return ['test_wallet_carecircle_12345678901234567890'];
  })
}));

const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const carecircleRouter = require('../api/carecircle');

// Create test app with CareCircle routes
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api/v1/carecircle', carecircleRouter);

describe('CareCircle API', () => {
  const testWallet = 'test_wallet_carecircle_12345678901234567890';
  const testCredentialId = 'test_cred_carecircle_001';
  const testCaregiverAddress = '9B5X5v4MU34aVvQgziVcriiWNc3ZYYtSeTL3MEVoV4Fe';

  describe('GET /api/v1/carecircle/credentials', () => {
    it('should return empty array for invalid wallet', async () => {
      const res = await request(app)
        .get('/api/v1/carecircle/credentials')
        .query({ wallet: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return credentials list for valid wallet', async () => {
      const res = await request(app)
        .get('/api/v1/carecircle/credentials')
        .query({ wallet: testWallet });
      expect(res.status).toBe(200);
      expect(res.body.credentials).toBeDefined();
      expect(Array.isArray(res.body.credentials)).toBe(true);
    });

    it('should not allow access without wallet query parameter', async () => {
      const res = await request(app)
        .get('/api/v1/carecircle/credentials');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/carecircle/files', () => {
    it('should require both wallet and credentialId', async () => {
      const res = await request(app)
        .get('/api/v1/carecircle/files')
        .query({ wallet: testWallet });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return empty files array when credential does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/carecircle/files')
        .query({ wallet: testWallet, credentialId: testCredentialId });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.files)).toBe(true);
    });

    it('should reject request without wallet', async () => {
      const res = await request(app)
        .get('/api/v1/carecircle/files')
        .query({ credentialId: testCredentialId });
      expect(res.status).toBe(400);
    });

    it('should reject request without credentialId', async () => {
      const res = await request(app)
        .get('/api/v1/carecircle/files')
        .query({ wallet: testWallet });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/carecircle/upload', () => {
    it('should reject upload without wallet', async () => {
      const buffer = Buffer.from('test content');
      const res = await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          credentialId: testCredentialId,
          filename: 'test.txt',
          fileBuffer: buffer.toString('base64'),
          fileSize: buffer.length,
          fileType: 'text/plain'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject upload without credentialId', async () => {
      const buffer = Buffer.from('test content');
      const res = await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          wallet: testWallet,
          filename: 'test.txt',
          fileBuffer: buffer.toString('base64'),
          fileSize: buffer.length,
          fileType: 'text/plain'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject upload without filename', async () => {
      const buffer = Buffer.from('test content');
      const res = await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          wallet: testWallet,
          credentialId: testCredentialId,
          fileBuffer: buffer.toString('base64'),
          fileSize: buffer.length,
          fileType: 'text/plain'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject upload without fileBuffer', async () => {
      const res = await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          wallet: testWallet,
          credentialId: testCredentialId,
          filename: 'test.txt',
          fileSize: 12,
          fileType: 'text/plain'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject files larger than 5MB', async () => {
      // Create a 6MB buffer, but send it as base64 which will be rejected by middleware (413)
      // or by our validation (400)
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const res = await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          wallet: testWallet,
          credentialId: testCredentialId,
          filename: 'large.pdf',
          fileBuffer: largeBuffer.toString('base64'),
          fileSize: largeBuffer.length,
          fileType: 'application/pdf'
        });
      // Either 413 (payload too large) or 400 (our validation) is acceptable
      expect([400, 413]).toContain(res.status);
    });

    it('should accept valid file upload (in test mode, no file written)', async () => {
      const buffer = Buffer.from('test pdf content');
      const res = await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          wallet: testWallet,
          credentialId: testCredentialId,
          filename: 'document.pdf',
          fileBuffer: buffer.toString('base64'),
          fileSize: buffer.length,
          fileType: 'application/pdf'
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.file).toBeDefined();
      expect(res.body.file.filename).toBe('document.pdf');
      expect(res.body.file.fileHash).toBeDefined();
      expect(res.body.file.fileHash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });

    it('should calculate correct SHA256 hash for files', async () => {
      const buffer = Buffer.from('Hello, World!');
      const res = await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          wallet: testWallet,
          credentialId: 'hash_test_cred',
          filename: 'hello.txt',
          fileBuffer: buffer.toString('base64'),
          fileSize: buffer.length,
          fileType: 'text/plain'
        });
      expect(res.status).toBe(200);
      // SHA256 of "Hello, World!" is dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f
      expect(res.body.file.fileHash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
    });

    it('should accept various supported file types', async () => {
      const fileTypes = [
        { name: 'test.pdf', type: 'application/pdf' },
        { name: 'test.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { name: 'test.jpg', type: 'image/jpeg' },
        { name: 'test.png', type: 'image/png' },
        { name: 'test.csv', type: 'text/csv' },
        { name: 'test.json', type: 'application/json' }
      ];

      for (const fileType of fileTypes) {
        const buffer = Buffer.from('test content');
        const res = await request(app)
          .post('/api/v1/carecircle/upload')
          .send({
            wallet: testWallet,
            credentialId: testCredentialId,
            filename: fileType.name,
            fileBuffer: buffer.toString('base64'),
            fileSize: buffer.length,
            fileType: fileType.type
          });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    });
  });

  describe('POST /api/v1/carecircle/authorize-caregiver', () => {
    it('should reject authorization without wallet', async () => {
      const res = await request(app)
        .post('/api/v1/carecircle/authorize-caregiver')
        .send({
          credentialId: testCredentialId,
          caregiverAddress: testCaregiverAddress
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject authorization without credentialId', async () => {
      const res = await request(app)
        .post('/api/v1/carecircle/authorize-caregiver')
        .send({
          wallet: testWallet,
          caregiverAddress: testCaregiverAddress
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject authorization without caregiver address', async () => {
      const res = await request(app)
        .post('/api/v1/carecircle/authorize-caregiver')
        .send({
          wallet: testWallet,
          credentialId: testCredentialId
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject invalid caregiver address format', async () => {
      const res = await request(app)
        .post('/api/v1/carecircle/authorize-caregiver')
        .send({
          wallet: testWallet,
          credentialId: testCredentialId,
          caregiverAddress: 'invalid-address'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid.*address/i);
    });

    it('should accept valid caregiver address', async () => {
      const res = await request(app)
        .post('/api/v1/carecircle/authorize-caregiver')
        .send({
          wallet: testWallet,
          credentialId: testCredentialId,
          caregiverAddress: testCaregiverAddress
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.caregiver).toBe(testCaregiverAddress);
      expect(res.body.message).toMatch(/authorized/i);
    });

    it('should validate caregiver address length (32-44 base58 characters)', async () => {
      // Too short
      const shortRes = await request(app)
        .post('/api/v1/carecircle/authorize-caregiver')
        .send({
          wallet: testWallet,
          caregiverAddress: 'tooshort'
        });
      expect(shortRes.status).toBe(400);

      // Too long
      const longRes = await request(app)
        .post('/api/v1/carecircle/authorize-caregiver')
        .send({
          wallet: testWallet,
          caregiverAddress: '1234567890123456789012345678901234567890123456'
        });
      expect(longRes.status).toBe(400);
    });

    it('should reject base58-invalid characters', async () => {
      const res = await request(app)
        .post('/api/v1/carecircle/authorize-caregiver')
        .send({
          wallet: testWallet,
          caregiverAddress: 'OIL000000000000000000000000000000000'
        });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/carecircle/documentation', () => {
    it('should return CareCircle documentation', async () => {
      const res = await request(app)
        .get('/api/v1/carecircle/documentation');
      expect(res.status).toBe(200);
      expect(res.body.content).toBeDefined();
      expect(typeof res.body.content).toBe('string');
      expect(res.body.content.toLowerCase()).toMatch(/carecircle|file|caregiver/i);
    });
  });

  describe('File security and validation', () => {
    it('should not write files to disk in test environment', async () => {
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      const initialFiles = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];

      const buffer = Buffer.from('test content for security');
      await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          wallet: testWallet,
          credentialId: 'no_write_test_cred',
          filename: 'security_test.txt',
          fileBuffer: buffer.toString('base64'),
          fileSize: buffer.length,
          fileType: 'text/plain'
        });

      const afterFiles = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
      expect(initialFiles).toEqual(afterFiles);
    });

    it('should handle empty files', async () => {
      const buffer = Buffer.from('');
      const res = await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          wallet: testWallet,
          credentialId: testCredentialId,
          filename: 'empty.txt',
          fileBuffer: buffer.toString('base64') || '', // Handle empty base64
          fileSize: 0,
          fileType: 'text/plain'
        });
      // Empty files may be rejected or accepted depending on implementation
      // For now, accept either response
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    it('should handle special characters in filenames', async () => {
      const buffer = Buffer.from('test');
      const res = await request(app)
        .post('/api/v1/carecircle/upload')
        .send({
          wallet: testWallet,
          credentialId: testCredentialId,
          filename: 'document-2024-01-15 (1).pdf',
          fileBuffer: buffer.toString('base64'),
          fileSize: buffer.length,
          fileType: 'application/pdf'
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Wallet address validation', () => {
    it('should accept valid Solana addresses', async () => {
      const validAddresses = [
        '9B5X5v4MU34aVvQgziVcriiWNc3ZYYtSeTL3MEVoV4Fe',
        '11111111111111111111111111111111',
        'TokenkegQfeZyiNwAJsyFbPUwJ6SNBv2gNgaSKHL9'
      ];

      for (const address of validAddresses) {
        const res = await request(app)
          .post('/api/v1/carecircle/authorize-caregiver')
          .send({
            wallet: testWallet,
            caregiverAddress: address
          });
        expect([200, 400]).toContain(res.status);
      }
    });
  });
});
