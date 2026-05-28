/**
 * HealthCred API Tests
 * Tests for credential registration and retrieval endpoints
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
    serialize(options = {}) {
      // Return valid buffer that can be deserialized
      return Buffer.from([0, 1, 2, 3, 4]);
    }
    static from(buffer) {
      // Create a Transaction from buffer
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
  Connection: class {
    constructor() {}
    getAccountInfo() {
      return Promise.resolve({ executable: true });
    }
    getLatestBlockhash() {
      return Promise.resolve({ blockhash: 'test_blockhash', lastValidBlockHeight: 999 });
    }
    sendRawTransaction() {
      return Promise.resolve('mock_tx_signature_' + Date.now());
    }
    confirmTransaction() {
      return Promise.resolve({ value: { err: null } });
    }
  }
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
    publicKey: { toBase58: () => 'payer_address_test' },
    sign: () => {}
  }
}));

const request = require('supertest');
const express = require('express');
const { credentialDb, badgeDb } = require('../api/database');

// Create a test server with the HealthCred router
const healthcredRouter = require('../api/healthcred');
const app = express();
app.use(express.json());
app.use('/api/v1/healthcred', healthcredRouter);

describe('HealthCred API Endpoints', () => {
  const testPrefix = 'jest_healthcred_' + Date.now();
  let createdCredentialIds = [];
  let testDid;

  // Helper to generate valid Solana address
  const genValidAddress = () => {
    const base58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let address = '';
    for (let i = 0; i < 44; i++) {
      address += base58chars.charAt(Math.floor(Math.random() * base58chars.length));
    }
    return address;
  };

  beforeAll(() => {
    testDid = {
      id: `did:test:${testPrefix}`,
      authentication: ['did:test:key-1', 'did:test:key-2']
    };
  });

  afterAll(() => {
    for (const credId of createdCredentialIds) {
      try {
        const db = require('better-sqlite3');
        const dbInstance = db('./pettracker.db');
        dbInstance.prepare('DELETE FROM badges WHERE credential_id = ?').run(credId);
        dbInstance.prepare('DELETE FROM certifications WHERE credential_id = ?').run(credId);
        dbInstance.prepare('DELETE FROM credentials WHERE id = ?').run(credId);
      } catch (err) {
        // Silently ignore
      }
    }
  });

  describe('POST /register', () => {
    test('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/register')
        .send({ fullName: 'Test Worker' })
        .expect(400);

      expect(res.body.error).toContain('Missing required fields');
    });

    test('should return 400 for invalid wallet address', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress: 'invalid',
          fullName: 'Test Worker',
          dateOfBirth: '1990-01-15',
          email: 'test@example.com',
          profession: 'Nurse',
          didDocumentJson: JSON.stringify(testDid)
        })
        .expect(400);

      expect(res.body.error).toContain('Invalid wallet address');
    });

    test('should return 400 for invalid DID document JSON', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress: genValidAddress(),
          fullName: 'Test Worker',
          dateOfBirth: '1990-01-15',
          email: 'test@example.com',
          profession: 'Nurse',
          didDocumentJson: 'not valid json'
        })
        .expect(400);

      expect(res.body.error).toContain('Invalid DID Document JSON');
    });

    test('should return 400 if DID document missing id field', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress: genValidAddress(),
          fullName: 'Test Worker',
          dateOfBirth: '1990-01-15',
          email: 'test@example.com',
          profession: 'Nurse',
          didDocumentJson: JSON.stringify({ authentication: [] })
        })
        .expect(400);

      expect(res.body.error).toContain('must contain valid "id"');
    });

    test('should return 400 if DID document missing authentication array', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress: genValidAddress(),
          fullName: 'Test Worker',
          dateOfBirth: '1990-01-15',
          email: 'test@example.com',
          profession: 'Nurse',
          didDocumentJson: JSON.stringify({ id: 'did:test:123' })
        })
        .expect(400);

      expect(res.body.error).toContain('must contain "authentication" array');
    });

    test('should return 400 for invalid DID document JSON', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress: 'FjdSNrxNPfcqYXjYzRTLmFWfJQ1pG7QPmtUP4iX2Rp1', // Valid base58
          fullName: 'Test Worker',
          dateOfBirth: '1990-01-15',
          email: 'test@example.com',
          profession: 'Nurse',
          didDocumentJson: 'not valid json'
        })
        .expect(400);

      expect(res.body.error).toContain('Invalid DID Document JSON');
    });

    test('should return 400 if DID document missing id field', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress: 'FjdSNrxNPfcqYXjYzRTLmFWfJQ1pG7QPmtUP4iX2Rp1',
          fullName: 'Test Worker',
          dateOfBirth: '1990-01-15',
          email: 'test@example.com',
          profession: 'Nurse',
          didDocumentJson: JSON.stringify({ authentication: [] })
        })
        .expect(400);

      expect(res.body.error).toContain('must contain valid "id"');
    });

    test('should return 400 if DID document missing authentication array', async () => {
      const res = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress: 'FjdSNrxNPfcqYXjYzRTLmFWfJQ1pG7QPmtUP4iX2Rp1',
          fullName: 'Test Worker',
          dateOfBirth: '1990-01-15',
          email: 'test@example.com',
          profession: 'Nurse',
          didDocumentJson: JSON.stringify({ id: 'did:test:123' })
        })
        .expect(400);

      expect(res.body.error).toContain('must contain "authentication" array');
    });

    test('should return unsigned transaction for valid registration request', async () => {
      const walletAddress = genValidAddress();
      const didDoc = {
        id: `did:test:${testPrefix}_${Math.random()}`,
        authentication: ['key-1', 'key-2', 'key-3']
      };

      const res = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Dr. Jane Smith',
          dateOfBirth: '1990-01-15',
          email: 'jane@healthcare.com',
          profession: 'Cardiologist',
          didDocumentJson: JSON.stringify(didDoc)
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.registrationId).toBeDefined();
      expect(res.body.transaction).toBeDefined();
      expect(res.body.metadata).toBeDefined();
      expect(res.body.metadata.walletAddress).toBe(walletAddress);
      expect(res.body.metadata.mint).toBeDefined();
    });

    test('should allow wallet to register multiple credentials with different DIDs', async () => {
      const walletAddress = genValidAddress();
      const didDoc1 = {
        id: `did:test:${testPrefix}_multi1_${Math.random()}`,
        authentication: ['key-1']
      };
      const didDoc2 = {
        id: `did:test:${testPrefix}_multi2_${Math.random()}`,
        authentication: ['key-2']
      };

      // First registration
      const res1 = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'First Worker',
          dateOfBirth: '1990-01-15',
          email: 'first@example.com',
          profession: 'Nurse',
          didDocumentJson: JSON.stringify(didDoc1)
        })
        .expect(200);

      // Complete the first registration by submitting signed transaction
      const signedTxMock = Buffer.from('mock_signed_tx').toString('base64');
      const submitRes = await request(app)
        .post('/api/v1/healthcred/submit-signed-transaction')
        .send({
          registrationId: res1.body.registrationId,
          signedTransaction: signedTxMock
        })
        .expect(200);

      createdCredentialIds.push(submitRes.body.credential.id);

      // Second registration with same wallet should succeed (different DID)
      const res2 = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Second Worker',
          dateOfBirth: '1990-01-15',
          email: 'second@example.com',
          profession: 'Doctor',
          didDocumentJson: JSON.stringify(didDoc2)
        })
        .expect(200);

      // Complete second registration
      const submitRes2 = await request(app)
        .post('/api/v1/healthcred/submit-signed-transaction')
        .send({
          registrationId: res2.body.registrationId,
          signedTransaction: signedTxMock
        })
        .expect(200);

      createdCredentialIds.push(submitRes2.body.credential.id);

      // Verify both credentials exist for this wallet
      expect(submitRes.body.credential.wallet_address).toBe(walletAddress);
      expect(submitRes2.body.credential.wallet_address).toBe(walletAddress);
      expect(submitRes.body.credential.id).not.toBe(submitRes2.body.credential.id);
      expect(submitRes.body.credential.did_id).not.toBe(submitRes2.body.credential.did_id);
    });

    test('should reject duplicate DID document hash within same wallet', async () => {
      const walletAddress = genValidAddress();
      const didDoc = {
        id: `did:test:${testPrefix}_dup_${Math.random()}`,
        authentication: ['key-1']
      };

      // First registration
      const res1 = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Worker One',
          dateOfBirth: '1990-01-15',
          email: 'worker1@example.com',
          profession: 'Nurse',
          didDocumentJson: JSON.stringify(didDoc)
        })
        .expect(200);

      // Complete the first registration
      const signedTxMock = Buffer.from('mock_signed_tx').toString('base64');
      const submitRes = await request(app)
        .post('/api/v1/healthcred/submit-signed-transaction')
        .send({
          registrationId: res1.body.registrationId,
          signedTransaction: signedTxMock
        })
        .expect(200);

      createdCredentialIds.push(submitRes.body.credential.id);

      // Second registration with SAME DID document should fail
      const res2 = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Worker Two',
          dateOfBirth: '1990-06-20',
          email: 'worker2@example.com',
          profession: 'Doctor',
          didDocumentJson: JSON.stringify(didDoc)
        })
        .expect(200); // First step still succeeds

      // Submitting with same DID should fail because did_document_hash is UNIQUE
      const submitRes2 = await request(app)
        .post('/api/v1/healthcred/submit-signed-transaction')
        .send({
          registrationId: res2.body.registrationId,
          signedTransaction: signedTxMock
        })
        .expect(500);

      expect(submitRes2.body.error).toContain('Failed to save credential');
    });
  });

  describe('GET /credentials', () => {
    test('should return credentials with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/healthcred/credentials?limit=10&offset=0')
        .expect(200);

      expect(Array.isArray(res.body.credentials)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('limit');
      expect(res.body.pagination).toHaveProperty('offset');
      expect(res.body.pagination).toHaveProperty('hasMore');
    });

    test('should return 400 for invalid limit', async () => {
      const res = await request(app)
        .get('/api/v1/healthcred/credentials?limit=-1&offset=0')
        .expect(400);

      expect(res.body.error).toContain('Invalid');
    });

    test('should enforce maximum limit of 100', async () => {
      const res = await request(app)
        .get('/api/v1/healthcred/credentials?limit=200&offset=0')
        .expect(200);

      expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
    });

    test('should not include DID document JSON in list', async () => {
      const res = await request(app)
        .get('/api/v1/healthcred/credentials?limit=100&offset=0')
        .expect(200);

      if (res.body.credentials.length > 0) {
        const cred = res.body.credentials[0];
        expect(cred.did_document_json).toBeUndefined();
        expect(cred.wallet_address).toBeDefined();
        expect(cred.full_name).toBeDefined();
      }
    });
  });

  describe('GET /credentials/:id', () => {
    test('should return a specific credential', async () => {
      // Create a credential first by completing both steps
      const walletAddress = genValidAddress();
      const didDoc = {
        id: `did:test:${testPrefix}_get_${Math.random()}`,
        authentication: ['key-1']
      };

      const registerRes = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Get Test Worker',
          dateOfBirth: '1990-01-15',
          email: 'get@example.com',
          profession: 'Therapist',
          didDocumentJson: JSON.stringify(didDoc)
        })
        .expect(200);

      // Submit signed transaction to complete registration
      const signedTxMock = Buffer.from('mock_signed_tx').toString('base64');
      const submitRes = await request(app)
        .post('/api/v1/healthcred/submit-signed-transaction')
        .send({
          registrationId: registerRes.body.registrationId,
          signedTransaction: signedTxMock
        })
        .expect(200);

      const credentialId = submitRes.body.credential.id;
      createdCredentialIds.push(credentialId);

      // Get the credential
      const getRes = await request(app)
        .get(`/api/v1/healthcred/credentials/${credentialId}`)
        .expect(200);

      expect(getRes.body.id).toBe(credentialId);
      expect(getRes.body.full_name).toBe('Get Test Worker');
      expect(getRes.body.profession).toBe('Therapist');
      expect(getRes.body.did_id).toBe(didDoc.id);
    });

    test('should return 404 for non-existent credential', async () => {
      const res = await request(app)
        .get('/api/v1/healthcred/credentials/non_existent_id')
        .expect(404);

      expect(res.body.error).toContain('not found');
    });

    test('should include badge count in response', async () => {
      // Create a credential first by completing both steps
      const walletAddress = genValidAddress();
      const didDoc = {
        id: `did:test:${testPrefix}_badge_${Math.random()}`,
        authentication: ['key-1']
      };

      const registerRes = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Badge Test Worker',
          dateOfBirth: '1990-01-15',
          email: 'badge@example.com',
          profession: 'Specialist',
          didDocumentJson: JSON.stringify(didDoc)
        })
        .expect(200);

      // Submit signed transaction to complete registration
      const signedTxMock = Buffer.from('mock_signed_tx').toString('base64');
      const submitRes = await request(app)
        .post('/api/v1/healthcred/submit-signed-transaction')
        .send({
          registrationId: registerRes.body.registrationId,
          signedTransaction: signedTxMock
        })
        .expect(200);

      const credentialId = submitRes.body.credential.id;
      createdCredentialIds.push(credentialId);

      // Get the credential
      const getRes = await request(app)
        .get(`/api/v1/healthcred/credentials/${credentialId}`)
        .expect(200);

      expect(getRes.body.badges_count).toBeDefined();
      expect(typeof getRes.body.badges_count).toBe('number');
    });
  });
});
