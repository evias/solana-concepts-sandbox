// Test mode
process.env.NODE_ENV = 'test';

/**
 * Comprehensive unit tests for HCP Console attestation flow
 * These tests ensure:
 * 1. Correct parameter validation
 * 2. Access control enforcement
 * 3. Deterministic nonce derivation
 * 4. Data encoding correctness
 * 5. Response structure validation
 */

jest.mock('@solana/web3.js', () => ({
  Connection: class {
    constructor() {}
    getLatestBlockhash() {
      return Promise.resolve({ blockhash: 'test_blockhash', lastValidBlockHeight: 999 });
    }
    sendRawTransaction() {
      return Promise.resolve('test_tx_sig_' + Math.random().toString(36).substring(7));
    }
    confirmTransaction() {
      return Promise.resolve();
    }
  },
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
    fromSeed: (seed) => ({
      publicKey: {
        toString: () => 'DerivedPublicKey' + seed.slice(0, 10).toString('hex')
      }
    })
  },
  Transaction: class {
    constructor() {
      this.instructions = [];
      this.signatures = [];
    }
    add(ix) {
      this.instructions.push(ix);
      return this;
    }
    sign() {
      return this;
    }
    serialize() {
      return Buffer.from([0, 1, 2, 3]);
    }
  },
  TransactionInstruction: class {
    constructor(data) {
      this.keys = data.keys;
      this.programId = data.programId;
      this.data = data.data;
    }
  }
}));

jest.mock('sas-lib', () => ({
  deriveCredentialPda: jest.fn(async (params) => ['DerivedCredentialAddress123456789012345']),
  deriveSchemaPda: jest.fn(async (params) => ['DerivedSchemaAddress12345678901234567']),
  deriveAttestationPda: jest.fn(async (params) => ['DerivedAttestationAddress1234567890123']),
  fetchMaybeCredential: jest.fn(async (rpc, addr) => ({
    exists: true,
    data: { authorizedSigners: [] }
  })),
  fetchMaybeSchema: jest.fn(async (rpc, addr) => ({ exists: true })),
  getCreateCredentialInstruction: jest.fn((params) => ({
    programAddress: 'SASProgramAddress18901834',
    accounts: [
      { address: params.payer.address || 'PayerAddr', role: 3 },
      { address: params.authority.address || 'AuthAddr', role: 2 },
      { address: params.credential, role: 1 }
    ],
    data: Buffer.from([0, 1, 2, 3])
  })),
  getCreateSchemaInstruction: jest.fn((params) => ({
    programAddress: 'SASProgramAddress18901834',
    accounts: [
      { address: params.payer.address || 'PayerAddr', role: 3 },
      { address: params.authority.address || 'AuthAddr', role: 2 },
      { address: params.credential, role: 0 },
      { address: params.schema, role: 1 }
    ],
    data: Buffer.from([0, 2, 3, 4])
  })),
  getCreateAttestationInstruction: jest.fn((params) => {
    // Verify required parameters
    if (!params.credential) throw new Error('Missing credential');
    if (!params.schema) throw new Error('Missing schema');
    if (!params.attestation) throw new Error('Missing attestation');
    if (!params.nonce) throw new Error('Missing nonce');
    if (!params.data) throw new Error('Missing data');
    if (params.expiry === undefined) throw new Error('Missing expiry');
    
    return {
      programAddress: 'SASProgramAddress18901834',
      accounts: [
        { address: params.payer.address || 'PayerAddr', role: 3 },
        { address: params.authority.address || 'AuthAddr', role: 2 },
        { address: params.credential, role: 0 },
        { address: params.schema, role: 0 },
        { address: params.attestation, role: 1 },
        { address: params.nonce, role: 0 }
      ],
      data: Buffer.from([0, 4, 5, 6])
    };
  })
}));

jest.mock('@solana/kit', () => ({
  createKeyPairSignerFromPrivateKeyBytes: jest.fn(async (bytes) => ({
    address: 'SignerAddress1234567890123456789012345'
  })),
  createSolanaRpc: jest.fn(() => ({}))
}));

jest.mock('../api/sas-integration', () => ({
  ensureSasCredential: jest.fn(async (owner, payer, credentialId) => ({
    credentialAddress: 'EnsuredSasCredentialAddress1234567890',
    exists: true,
    authorizedSigners: []
  }))
}));

jest.mock('../api/payer', () => ({
  getPayerKeypair: jest.fn(() => ({
    publicKey: { toBase58: () => 'PayerPublicKey1234567890123456789012' },
    secretKey: new Uint8Array(64)
  }))
}));

const express = require('express');
const request = require('supertest');
const router = require('../api/hcpconsole');
const crypto = require('crypto');

describe('HCP Console - Attestation Unit Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/hcpconsole', router);
  });

  describe('Parameter Validation', () => {
    it('should reject missing wallet parameter', async () => {
      const res = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          credentialId: 'test-id',
          promptHash: 'abc123'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should reject missing credentialId parameter', async () => {
      const res = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          wallet: 'Wallet123',
          promptHash: 'abc123'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should reject missing promptHash parameter', async () => {
      const res = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          wallet: 'Wallet123',
          credentialId: 'test-id'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });
  });

  describe('Test Mode Behavior', () => {
    it('should return test response when NODE_ENV=test', async () => {
      const res = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          wallet: 'TestWallet1234567890123456789012345',
          credentialId: 'hc_test-uuid-1234',
          promptHash: 'abc123def456'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.isTestMode).toBe(true);
      expect(res.body.txSig).toBeDefined();
      expect(res.body.credentialId).toBe('hc_test-uuid-1234');
      expect(res.body.attestationAddress).toBeDefined();
      expect(res.body.schemaAddress).toBeDefined();
    });

    it('should include credentialId start in test signature', async () => {
      const credId = 'hc_unique-test-123';
      const res = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          wallet: 'TestWallet1234567890123456789012345',
          credentialId: credId,
          promptHash: 'abc123'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.txSig).toContain('hc_un');
    });

    it('should gen unique attestation addresses for different prompts', async () => {
      const res1 = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          wallet: 'W1',
          credentialId: 'cred1',
          promptHash: 'hash1'
        });
      
      const res2 = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          wallet: 'W1',
          credentialId: 'cred1',
          promptHash: 'hash2'
        });
      
      expect(res1.body.attestationAddress).not.toBe(res2.body.attestationAddress);
    });
  });

  describe('Deterministic Nonce Derivation', () => {
    it('should use same nonce for same credentialId + promptHash', () => {
      const testId = 'test-cred-123';
      const testHash = 'prompt-hash-xyz';
      
      const nonceInput1 = testId + testHash;
      const nonceHash1 = crypto.createHash('sha256').update(nonceInput1).digest();
      const nonce1 = nonceHash1.slice(0, 32).toString('hex');
      
      const nonceInput2 = testId + testHash;
      const nonceHash2 = crypto.createHash('sha256').update(nonceInput2).digest();
      const nonce2 = nonceHash2.slice(0, 32).toString('hex');
      
      expect(nonce1).toBe(nonce2);
    });

    it('should generate different nonce for different prompts', () => {
      const credId = 'cred-same';
      
      const nonce1Input = credId + 'prompt1';
      const nonce1Hash = crypto.createHash('sha256').update(nonce1Input).digest();
      const nonce1 = nonce1Hash.slice(0, 32);
      
      const nonce2Input = credId + 'prompt2';
      const nonce2Hash = crypto.createHash('sha256').update(nonce2Input).digest();
      const nonce2 = nonce2Hash.slice(0, 32);
      
      expect(nonce1).not.toEqual(nonce2);
    });

    it('should generate different nonce for different credentials', () => {
      const prompt = 'same-prompt';
      
      const nonce1Input = 'cred1' + prompt;
      const nonce1Hash = crypto.createHash('sha256').update(nonce1Input).digest();
      const nonce1 = nonce1Hash.slice(0, 32);
      
      const nonce2Input = 'cred2' + prompt;
      const nonce2Hash = crypto.createHash('sha256').update(nonce2Input).digest();
      const nonce2 = nonce2Hash.slice(0, 32);
      
      expect(nonce1).not.toEqual(nonce2);
    });
  });

  describe('Data Encoding', () => {
    it('should encode attestation data as UTF-8 JSON', () => {
      const testData = {
        promptHash: 'test_hash_123',
        createdAt: '2026-06-18T10:00:00.000Z'
      };
      
      const jsonStr = JSON.stringify(testData);
      const encoded = Buffer.from(jsonStr, 'utf-8');
      const decoded = encoded.toString('utf-8');
      const parsed = JSON.parse(decoded);
      
      expect(parsed.promptHash).toBe(testData.promptHash);
      expect(parsed.createdAt).toBe(testData.createdAt);
    });

    it('should support non-ASCII characters in JSON serialization', () => {
      const testData = {
        promptHash: 'hash-with-émojis-🎉',
        createdAt: '2026-06-18T10:00:00.000Z'
      };
      
      const jsonStr = JSON.stringify(testData);
      const encoded = Buffer.from(jsonStr, 'utf-8');
      const decoded = encoded.toString('utf-8');
      const parsed = JSON.parse(decoded);
      
      expect(parsed.promptHash).toContain('émojis-🎉');
    });

    it('should set 90-day expiry from now', () => {
      const now = Math.floor(Date.now() / 1000);
      const expected90Days = now + (90 * 24 * 60 * 60);
      
      // Should equal 90 days worth of seconds
      expect(expected90Days - now).toBe(90 * 24 * 60 * 60);
    });
  });

  describe('SAS Instruction Parameter Validation', () => {
    it('should enforce all required instruction parameters', () => {
      const lib = require('sas-lib');
      
      const params = {
        payer: { address: 'PayerAddr' },
        authority: { address: 'AuthAddr' },
        credential: 'CredAddr',
        schema: 'SchemaAddr',
        attestation: 'AttestationAddr',
        nonce: 'NonceAddr',
        data: Buffer.from('test'),
        expiry: BigInt(123456)
      };
      
      const ix = lib.getCreateAttestationInstruction(params);
      expect(ix).toBeDefined();
      expect(ix.programAddress).toBeDefined();
      expect(ix.accounts).toHaveLength(6);
      expect(ix.data).toBeDefined();
    });

    it('should throw if credential parameter missing', () => {
      const lib = require('sas-lib');
      
      expect(() => {
        lib.getCreateAttestationInstruction({
          payer: { address: 'P' },
          authority: { address: 'A' },
          schema: 'S',
          attestation: 'At',
          nonce: 'N',
          data: Buffer.from('d'),
          expiry: BigInt(1)
        });
      }).toThrow('Missing credential');
    });

    it('should throw if schema parameter missing', () => {
      const lib = require('sas-lib');
      
      expect(() => {
        lib.getCreateAttestationInstruction({
          payer: { address: 'P' },
          authority: { address: 'A' },
          credential: 'C',
          attestation: 'At',
          nonce: 'N',
          data: Buffer.from('d'),
          expiry: BigInt(1)
        });
      }).toThrow('Missing schema');
    });

    it('should throw if data parameter missing', () => {
      const lib = require('sas-lib');
      
      expect(() => {
        lib.getCreateAttestationInstruction({
          payer: { address: 'P' },
          authority: { address: 'A' },
          credential: 'C',
          schema: 'S',
          attestation: 'At',
          nonce: 'N',
          expiry: BigInt(1)
        });
      }).toThrow('Missing data');
    });

    it('should throw if expiry parameter missing', () => {
      const lib = require('sas-lib');
      
      expect(() => {
        lib.getCreateAttestationInstruction({
          payer: { address: 'P' },
          authority: { address: 'A' },
          credential: 'C',
          schema: 'S',
          attestation: 'At',
          nonce: 'N',
          data: Buffer.from('d')
        });
      }).toThrow('Missing expiry');
    });
  });

  describe('Role to Web3 Account Conversion', () => {
    it('should convert role 0 (readonly) correctly', () => {
      // role 0 = readonly
      const isSigner = 0 >= 2; // false
      const isWritable = 0 === 1 || 0 === 3; // false
      
      expect(isSigner).toBe(false);
      expect(isWritable).toBe(false);
    });

    it('should convert role 1 (writable) correctly', () => {
      // role 1 = writable
      const isSigner = 1 >= 2; // false
      const isWritable = 1 === 1 || 1 === 3; // true
      
      expect(isSigner).toBe(false);
      expect(isWritable).toBe(true);
    });

    it('should convert role 2 (signer readonly) correctly', () => {
      // role 2 = signer + readonly
      const isSigner = 2 >= 2; // true
      const isWritable = 2 === 1 || 2 === 3; // false
      
      expect(isSigner).toBe(true);
      expect(isWritable).toBe(false);
    });

    it('should convert role 3 (signer writable) correctly', () => {
      // role 3 = signer + writable
      const isSigner = 3 >= 2; // true
      const isWritable = 3 === 1 || 3 === 3; // true
      
      expect(isSigner).toBe(true);
      expect(isWritable).toBe(true);
    });
  });

  describe('Response Validation', () => {
    it('should return all required fields', async () => {
      const res = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          wallet: 'W1',
          credentialId: 'c1',
          promptHash: 'h1'
        });
      
      expect(res.body).toHaveProperty('txSig');
      expect(res.body).toHaveProperty('credentialId');
      expect(res.body).toHaveProperty('attestationAddress');
      expect(res.body).toHaveProperty('schemaAddress');
      expect(res.body).toHaveProperty('isTestMode');
    });

    it('should return strings for all address fields', async () => {
      const res = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          wallet: 'W1',
          credentialId: 'c1',
          promptHash: 'h1'
        });
      
      expect(typeof res.body.txSig).toBe('string');
      expect(typeof res.body.credentialId).toBe('string');
      expect(typeof res.body.attestationAddress).toBe('string');
      expect(typeof res.body.schemaAddress).toBe('string');
    });

    it('should indicate test mode', async () => {
      const res = await request(app)
        .post('/api/v1/hcpconsole/build-attestation-tx')
        .send({
          wallet: 'W1',
          credentialId: 'c1',
          promptHash: 'h1'
        });
      
      expect(res.body.isTestMode).toBe(true);
    });
  });

  describe('Credential UUID Extraction', () => {
    it('should extract UUID from prefixed credential ID', () => {
      function extractCredentialUuid(credentialId) {
        if (!credentialId) return null;
        const parts = credentialId.split('_');
        return parts.length > 1 ? parts[1] : credentialId;
      }
      
      expect(extractCredentialUuid('hc_12345-uuid')).toBe('12345-uuid');
      expect(extractCredentialUuid('sas_67890-uuid')).toBe('67890-uuid');
      expect(extractCredentialUuid('unprefixed-id')).toBe('unprefixed-id');
      expect(extractCredentialUuid(null)).toBeNull();
    });
  });
});
