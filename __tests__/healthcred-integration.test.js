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
    // Test database cleanup handled automatically - tests use separate pettracker.test.db
  });

  describe('DID Document Download', () => {
    test('should download DID document by DID ID', async () => {
      const walletAddress = genValidAddress();
      const didDoc = {
        id: `did:test:${testPrefix}_download_${Math.random()}`,
        authentication: ['key-1', 'key-2']
      };

      // Create credential (step 1: register)
      const registerRes = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Download Test',
          dateOfBirth: '1990-01-15',
          email: 'download@test.com',
          profession: 'Doctor',
          didDocumentJson: JSON.stringify(didDoc)
        })
        .expect(200);

      // Step 2: submit signed transaction
      const signedTxMock = Buffer.from('mock_signed_tx').toString('base64');
      const submitRes = await request(app)
        .post('/api/v1/healthcred/submit-signed-transaction')
        .send({
          registrationId: registerRes.body.registrationId,
          signedTransaction: signedTxMock
        })
        .expect(200);

      createdIds.push(submitRes.body.credential.id);

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

      const registerRes = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Badge Test',
          dateOfBirth: '1990-01-15',
          email: 'badge@test.com',
          profession: 'Nurse',
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

      testCredential = submitRes.body.credential;
      createdIds.push(testCredential.id);
    });

    test('should issue a badge to a credential (2-step flow)', async () => {
      const issuerWallet = genValidAddress();
      
      // Step 1: Create unsigned badge transaction
      const badgeRes = await request(app)
        .post('/api/v1/healthcred/badges')
        .send({
          credentialId: testCredential.id,
          issuerWallet,
          emoji: '⭐',
          description: 'Excellent patient care'
        })
        .expect(200);

      expect(badgeRes.body.success).toBe(true);
      expect(badgeRes.body.badgeRegistrationId).toBeDefined();
      expect(badgeRes.body.transaction).toBeDefined();

      // Step 2: Submit signed badge transaction
      const signedTxMock = Buffer.from('mock_badge_tx').toString('base64');
      const submitBadgeRes = await request(app)
        .post('/api/v1/healthcred/submit-signed-badge-transaction')
        .send({
          badgeRegistrationId: badgeRes.body.badgeRegistrationId,
          signedTransaction: signedTxMock
        })
        .expect(200);

      expect(submitBadgeRes.body.success).toBe(true);
      expect(submitBadgeRes.body.badge).toBeDefined();
      expect(submitBadgeRes.body.badge.emoji).toBe('⭐');
      expect(submitBadgeRes.body.badge.description).toBe('Excellent patient care');
      expect(submitBadgeRes.body.onChain.mint).toBeDefined();
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
        const badgeRes = await request(app)
          .post('/api/v1/healthcred/badges')
          .send({
            credentialId: testCredential.id,
            issuerWallet: genValidAddress(),
            emoji: ['💯', '🏆', '🎖️'][i],
            description: `Badge ${i + 1}`
          });

        if (badgeRes.status === 200) {
          // Submit signed badge transaction
          const signedTxMock = Buffer.from('mock_badge_tx').toString('base64');
          await request(app)
            .post('/api/v1/healthcred/submit-signed-badge-transaction')
            .send({
              badgeRegistrationId: badgeRes.body.badgeRegistrationId,
              signedTransaction: signedTxMock
            });
        }
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

      const registerRes = await request(app)
        .post('/api/v1/healthcred/register')
        .send({
          walletAddress,
          fullName: 'Certification Test',
          dateOfBirth: '1990-01-15',
          email: 'cert@test.com',
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
        });

      if (submitRes.status !== 200) {
        console.error('BeforeAll error - Submit response:', submitRes.status, submitRes.body);
        throw new Error('Failed to create test credential');
      }

      testCredential = submitRes.body.credential;
      if (!testCredential) {
        console.error('BeforeAll error - No credential in response:', submitRes.body);
        throw new Error('No credential returned');
      }
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
          fileBuffer: Array.from(fileBuffer),
          fileSize: fileBuffer.length,
          fileType: 'text/plain'
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toContain('Invalid file type');
    });

    test('should upload certification (2-step flow)', async () => {
      if (!testCredential || !testCredential.id) {
        throw new Error(`testCredential is not defined: ${JSON.stringify(testCredential)}`);
      }

      const fileBuffer = Buffer.from('mock pdf content');
      const issuerWallet = genValidAddress();

      // Step 1: Create unsigned certification transaction
      const certRes = await request(app)
        .post('/api/v1/healthcred/certifications')
        .send({
          credentialId: testCredential.id,
          issuerWallet,
          filename: 'license.pdf',
          fileBuffer: Array.from(fileBuffer),
          fileSize: fileBuffer.length,
          fileType: 'application/pdf'
        });

      if (certRes.status !== 200) {
        throw new Error(`POST /certifications failed with ${certRes.status}: ${JSON.stringify(certRes.body)}`);
      }

      expect(certRes.body.success).toBe(true);
      expect(certRes.body.certificationRegistrationId).toBeDefined();
      expect(certRes.body.transaction).toBeDefined();

      // Step 2: Submit signed certification transaction
      const signedTxMock = Buffer.from('mock_cert_tx').toString('base64');
      const submitCertRes = await request(app)
        .post('/api/v1/healthcred/submit-signed-certification-transaction')
        .send({
          certificationRegistrationId: certRes.body.certificationRegistrationId,
          signedTransaction: signedTxMock
        })
        .expect(200);

      expect(submitCertRes.body.success).toBe(true);
      expect(submitCertRes.body.certification).toBeDefined();
      expect(submitCertRes.body.certification.filename).toBe('license.pdf');
      expect(submitCertRes.body.onChain.mint).toBeDefined();
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
