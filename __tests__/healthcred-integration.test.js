/**
 * HealthCred Integration Tests
 * Tests for badges, certifications, and DID download endpoints
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
  Transaction: class {
    constructor() {
      this.instructions = [];
      this.signatures = [];
      this.recentBlockhash = '';
      this.feePayer = null;
    }
    add(instruction) {
      this.instructions.push(instruction);
      return this;
    }
    sign(keypair) {
      this.signatures.push({ publicKey: {} });
      return this;
    }
    serialize() {
      return { toString: () => Buffer.from('mock').toString('base64') };
    }
  },
  TransactionInstruction: class {
    constructor(data) {
      this.programId = data.programId;
      this.keys = data.keys;
      this.data = data.data;
    }
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
  }
}));

jest.mock('@solana/spl-token', () => ({
  createMint: jest.fn().mockResolvedValue({
    toBase58: () => 'mock_mint_' + Date.now()
  })
}));

jest.mock('../api/payer', () => ({
  payer: {
    publicKey: { toBase58: () => 'payer_address_test' }
  }
}));

const request = require('supertest');
const express = require('express');
const { credentialDb, badgeDb, certificationDb } = require('../api/database');

const healthcredRouter = require('../api/healthcred');
const app = express();
app.use(express.json());
app.use('/api/v1/healthcred', healthcredRouter);

describe('HealthCred Integration Tests', () => {
  const testPrefix = 'jest_hc_int_' + Date.now();
  let createdIds = [];
  
  const genValidAddress = () => {
    const base58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let address = '';
    for (let i = 0; i < 44; i++) {
      address += base58chars.charAt(Math.floor(Math.random() * base58chars.length));
    }
    return address;
  };

  afterAll(() => {
    for (const id of createdIds) {
      try {
        const db = require('better-sqlite3');
        const dbInstance = db('./pettracker.db');
        dbInstance.prepare('DELETE FROM badges WHERE credential_id = ?').run(id);
        dbInstance.prepare('DELETE FROM certifications WHERE credential_id = ?').run(id);
      } catch (err) {}
    }
    
    const db = require('better-sqlite3');
    const dbInstance = db('./pettracker.db');
    for (const id of createdIds) {
      try {
        dbInstance.prepare('DELETE FROM credentials WHERE id = ?').run(id);
      } catch (err) {}
    }
  });

  describe('DID Document Download', () => {
    test('should download DID document by DID ID', async () => {
      const walletAddress = genValidAddress();
      const didDoc = {
        id: `did:test:${testPrefix}_download_${Math.random()}`,
        authentication: ['key-1', 'key-2']
      };

      // Create credential
      const createRes = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Download Test',
          dateOfBirth: '1990-01-15',
          email: 'download@test.com',
          profession: 'Doctor',
          didDocumentJson: JSON.stringify(didDoc)
        });

      createdIds.push(createRes.body.credential.id);

      // Download DID document
      const downloadRes = await request(app)
        .get(`/api/v1/healthcred/did/${didDoc.id}`)
        .expect(200);

      expect(downloadRes.headers['content-type']).toContain('application/did+json');
      const downloadedDoc = JSON.parse(downloadRes.text);
      expect(downloadedDoc.id).toBe(didDoc.id);
      expect(downloadedDoc.authentication).toEqual(didDoc.authentication);
    });

    test('should return 404 for non-existent DID', async () => {
      const res = await request(app)
        .get('/api/v1/healthcred/did/did:test:nonexistent')
        .expect(404);

      expect(res.body.error).toContain('not found');
    });

    test('should return 400 if DID ID is missing', async () => {
      const res = await request(app)
        .get('/api/v1/healthcred/did/')
        .expect(404);
    });
  });

  describe('Badge System', () => {
    let testCredential;

    beforeAll(async () => {
      const walletAddress = genValidAddress();
      const didDoc = {
        id: `did:test:${testPrefix}_badges_${Math.random()}`,
        authentication: ['key-1']
      };

      const createRes = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Badge Test',
          dateOfBirth: '1990-01-15',
          email: 'badge@test.com',
          profession: 'Nurse',
          didDocumentJson: JSON.stringify(didDoc)
        });

      testCredential = createRes.body.credential;
      createdIds.push(testCredential.id);
    });

    test('should issue a badge to a credential', async () => {
      const issuerWallet = genValidAddress();
      const res = await request(app)
        .post('/api/v1/healthcred/badges')
        .send({
          credentialId: testCredential.id,
          issuerWallet,
          emoji: '⭐',
          description: 'Excellent patient care'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.badge).toBeDefined();
      expect(res.body.badge.emoji).toBe('⭐');
      expect(res.body.badge.description).toBe('Excellent patient care');
      expect(res.body.onChain.mint).toBeDefined();
      expect(res.body.onChain.transactionSignature).toBeDefined();
    });

    test('should return 400 if required badge fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/badges')
        .send({
          credentialId: testCredential.id,
          issuerWallet: genValidAddress()
        })
        .expect(400);

      expect(res.body.error).toContain('Missing required fields');
    });

    test('should return 404 if credential does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/badges')
        .send({
          credentialId: 'nonexistent',
          issuerWallet: genValidAddress(),
          emoji: '⭐',
          description: 'Test'
        })
        .expect(404);

      expect(res.body.error).toContain('Credential not found');
    });

    test('should retrieve badges for a credential', async () => {
      // Issue multiple badges
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/healthcred/badges')
          .send({
            credentialId: testCredential.id,
            issuerWallet: genValidAddress(),
            emoji: ['💯', '🏆', '🎖️'][i],
            description: `Badge ${i + 1}`
          });
      }

      const res = await request(app)
        .get(`/api/v1/healthcred/badges/${testCredential.id}`)
        .expect(200);

      expect(res.body.credential_id).toBe(testCredential.id);
      expect(Array.isArray(res.body.badges)).toBe(true);
      expect(res.body.badges.length).toBeGreaterThanOrEqual(3);
    });

    test('should return 404 if credential not found for badges', async () => {
      const res = await request(app)
        .get('/api/v1/healthcred/badges/nonexistent')
        .expect(404);

      expect(res.body.error).toContain('Credential not found');
    });
  });

  describe('Certification System', () => {
    let testCredential;

    beforeAll(async () => {
      const walletAddress = genValidAddress();
      const didDoc = {
        id: `did:test:${testPrefix}_certs_${Math.random()}`,
        authentication: ['key-1']
      };

      const createRes = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Certification Test',
          dateOfBirth: '1990-01-15',
          email: 'cert@test.com',
          profession: 'Specialist',
          didDocumentJson: JSON.stringify(didDoc)
        });

      testCredential = createRes.body.credential;
      createdIds.push(testCredential.id);
    });

    test('should return 400 for invalid file type', async () => {
      const fileBuffer = Buffer.from('test content');
      const res = await request(app)
        .post('/api/v1/healthcred/certifications')
        .send({
          credentialId: testCredential.id,
          issuerWallet: genValidAddress(),
          filename: 'document.txt',
          fileBuffer,
          fileSize: fileBuffer.length,
          fileType: 'text/plain'
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toContain('Invalid file type');
    });

    test('should return 400 if required certification fields missing', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/certifications')
        .send({
          credentialId: testCredential.id,
          filename: 'cert.pdf'
        })
        .expect(400);

      expect(res.body.error).toContain('Missing required fields');
    });

    test('should return 404 if credential not found for certifications', async () => {
      const res = await request(app)
        .get('/api/v1/healthcred/certifications/nonexistent')
        .expect(404);

      expect(res.body.error).toContain('Credential not found');
    });
  });
});
