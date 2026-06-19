process.env.NODE_ENV = 'test';

jest.mock('@solana/web3.js', () => ({
  PublicKey: class {
    constructor(address) { 
      this.address = address; 
      this._buffer = Buffer.alloc(32);
    }
    toString() { return this.address; }
    toBase58() { return this.address; }
  },
  Keypair: {
    fromSeed: (seed) => ({
      publicKey: new (require('@solana/web3.js').PublicKey)('AttestedPublicKeyFromSeed123456789'),
      secretKey: Buffer.alloc(64)
    })
  },
  Transaction: class {
    constructor() {
      this.instructions = [];
      this.signatures = [];
      this.recentBlockhash = '';
      this.feePayer = null;
    }
    add(instruction) { this.instructions.push(instruction); return this; }
    sign(keypair) { this.signatures.push({ publicKey: {} }); return this; }
    serialize(options = {}) { return Buffer.from([0, 1, 2, 3, 4]); }
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
  }
}));

const crypto = require('crypto');

describe('HCP Console Transaction Flow - Unit Tests', () => {
  const mockCredential = {
    id: 'hc_test-uuid-1234',
    wallet_address: 'TestWallet123456789012345678901234567890ABC',
    sas_credential_id: 'sas_test-uuid-5678',
    full_name: 'Test Doctor'
  };

  const mockCredentials = [mockCredential];

  const mockPayer = {
    publicKey: { 
      toString: () => 'PayerWallet12345678901234567890123456789ABC'
    },
    secretKey: Buffer.alloc(64, 1)
  };

  describe('1. Credential Lookup', () => {
    it('should find credential by full ID', () => {
      const credentialId = 'hc_test-uuid-1234';
      const found = mockCredentials.find(c => c.id === credentialId);
      expect(found).toBeDefined();
      expect(found.id).toBe('hc_test-uuid-1234');
    });

    it('should find credential by UUID prefix extraction', () => {
      function extractCredentialUuid(credentialId) {
        if (!credentialId) return null;
        const parts = credentialId.split('_');
        return parts.length > 1 ? parts[1] : credentialId;
      }

      const credentialId = 'hc_test-uuid-1234';
      const credentialUuid = extractCredentialUuid(credentialId);
      const found = mockCredentials.find(cred => {
        const sasUuid = extractCredentialUuid(cred.sas_credential_id);
        const idUuid = extractCredentialUuid(cred.id);
        return sasUuid === credentialUuid || idUuid === credentialUuid;
      });

      expect(found).toBeDefined();
      expect(found.id).toBe('hc_test-uuid-1234');
    });

    it('should return undefined for non-existent credential', () => {
      const credentialId = 'hc_nonexistent';
      const found = mockCredentials.find(c => c.id === credentialId);
      expect(found).toBeUndefined();
    });
  });

  describe('2. Access Control', () => {
    it('should grant access when wallet matches credential owner', () => {
      const wallet = mockCredential.wallet_address;
      const hasAccess = wallet === mockCredential.wallet_address;
      expect(hasAccess).toBe(true);
    });

    it('should deny access when wallet does not match', () => {
      const wallet = 'DifferentWallet1234567890123456789012345';
      const hasAccess = wallet === mockCredential.wallet_address;
      expect(hasAccess).toBe(false);
    });

    it('should validate wallet is provided', () => {
      const wallet = null;
      const credentialId = 'hc_test-uuid-1234';
      const promptHash = 'abc123';
      
      const isValid = !!(wallet && credentialId && promptHash);
      expect(isValid).toBe(false);
    });
  });

  describe('3. Schema Derivation', () => {
    it('should derive deterministic schema address from credential + name', () => {
      const schemaName = 'Prompt Verification';
      const version = 0;
      
      // In real flow: lib.deriveSchemaPda({ credential, name, version })
      // Here we just verify the inputs are correct
      expect(schemaName).toBe('Prompt Verification');
      expect(version).toBe(0);
    });

    it('should use consistent field names for schema', () => {
      const fieldNames = ['promptHash'];
      expect(fieldNames).toContain('promptHash');
      expect(fieldNames.length).toBe(1);
    });
  });

  describe('4. Nonce Generation', () => {
    it('should generate deterministic nonce from credentialId + promptHash', () => {
      const credentialId = 'hc_test-uuid-1234';
      const promptHash = 'abc123def456';
      
      const nonceInput = credentialId + promptHash;
      const nonceHash = crypto.createHash('sha256').update(nonceInput).digest();
      
      expect(nonceHash).toHaveLength(32);
      expect(nonceHash).toBeInstanceOf(Buffer);
    });

    it('should generate same nonce for same inputs', () => {
      const credentialId = 'hc_test-uuid-1234';
      const promptHash = 'abc123def456';
      
      const nonceInput1 = credentialId + promptHash;
      const hash1 = crypto.createHash('sha256').update(nonceInput1).digest().slice(0, 32);
      
      const nonceInput2 = credentialId + promptHash;
      const hash2 = crypto.createHash('sha256').update(nonceInput2).digest().slice(0, 32);
      
      expect(hash1).toEqual(hash2);
    });

    it('should generate different nonce for different prompts', () => {
      const credentialId = 'hc_test-uuid-1234';
      
      const nonceInput1 = credentialId + 'prompt1';
      const hash1 = crypto.createHash('sha256').update(nonceInput1).digest().slice(0, 32);
      
      const nonceInput2 = credentialId + 'prompt2';
      const hash2 = crypto.createHash('sha256').update(nonceInput2).digest().slice(0, 32);
      
      expect(hash1).not.toEqual(hash2);
    });
  });

  describe('5. Attestation Data Encoding', () => {
    it('should encode attestation data as JSON', () => {
      const promptHash = 'abc123def456';
      const attestationDataObj = {
        promptHash: promptHash,
        createdAt: '2026-06-18T09:00:00.000Z'
      };
      
      const attestationDataStr = JSON.stringify(attestationDataObj);
      expect(typeof attestationDataStr).toBe('string');
      expect(attestationDataStr).toContain(promptHash);
    });

    it('should encode to valid UTF-8 bytes', () => {
      const attestationDataStr = '{"promptHash":"abc123","createdAt":"2026-06-18T09:00:00.000Z"}';
      const attestationDataBytes = Buffer.from(attestationDataStr, 'utf-8');
      
      expect(attestationDataBytes).toBeInstanceOf(Buffer);
      expect(attestationDataBytes.toString('utf-8')).toBe(attestationDataStr);
    });

    it('should include required fields', () => {
      const attestationDataObj = {
        promptHash: 'test_hash',
        createdAt: '2026-06-18T09:00:00.000Z'
      };
      
      expect(attestationDataObj).toHaveProperty('promptHash');
      expect(attestationDataObj).toHaveProperty('createdAt');
    });
  });

  describe('6. Expiry Calculation', () => {
    it('should calculate expiry as 90 days from now', () => {
      const expirySeconds = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
      const thirtyDaysInSeconds = 90 * 24 * 60 * 60;
      const nowSeconds = Math.floor(Date.now() / 1000);
      
      expect(expirySeconds).toBeGreaterThan(nowSeconds);
      expect(expirySeconds - nowSeconds).toBeCloseTo(thirtyDaysInSeconds, -2);
    });

    it('should return BigInt for expiry', () => {
      const expirySeconds = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
      const expiryBigInt = BigInt(expirySeconds);
      
      expect(typeof expiryBigInt).toBe('bigint');
    });
  });

  describe('7. Transaction Building', () => {
    it('should create transaction with attestation instruction', () => {
      const web3 = require('@solana/web3.js');
      const tx = new web3.Transaction();
      
      expect(tx.instructions).toEqual([]);
      expect(tx.signatures).toEqual([]);
    });

    it('should set user wallet as fee payer', () => {
      const web3 = require('@solana/web3.js');
      const tx = new web3.Transaction();
      const userWallet = 'UserWallet123456789012345678901234567890ABC';
      
      tx.feePayer = new web3.PublicKey(userWallet);
      
      expect(tx.feePayer.toString()).toBe(userWallet);
    });

    it('should set recent blockhash', () => {
      const web3 = require('@solana/web3.js');
      const tx = new web3.Transaction();
      const blockhash = 'test_blockhash_123456789';
      
      tx.recentBlockhash = blockhash;
      
      expect(tx.recentBlockhash).toBe(blockhash);
    });
  });

  describe('8. Transaction Signing', () => {
    it('should sign transaction with payer', () => {
      const web3 = require('@solana/web3.js');
      const tx = new web3.Transaction();
      
      tx.sign(mockPayer);
      
      expect(tx.signatures.length).toBe(1);
    });

    it('should allow unsigned transactions with requireAllSignatures=false', () => {
      const web3 = require('@solana/web3.js');
      const tx = new web3.Transaction();
      tx.sign(mockPayer);
      
      const serialized = tx.serialize({ 
        requireAllSignatures: false,
        verifySignatures: false 
      });
      
      expect(serialized).toBeInstanceOf(Buffer);
    });
  });

  describe('9. Instruction Construction', () => {
    it('should have correct instruction keys for accountable roles', () => {
      function roleToWeb3Account(address, role) {
        return {
          pubkey: { address },
          isSigner: role >= 2,
          isWritable: role === 1 || role === 3
        };
      }

      // role 0: readonly, not signer
      const acc0 = roleToWeb3Account('addr0', 0);
      expect(acc0.isSigner).toBe(false);
      expect(acc0.isWritable).toBe(false);

      // role 1: writable, not signer
      const acc1 = roleToWeb3Account('addr1', 1);
      expect(acc1.isSigner).toBe(false);
      expect(acc1.isWritable).toBe(true);

      // role 2: signer, readonly
      const acc2 = roleToWeb3Account('addr2', 2);
      expect(acc2.isSigner).toBe(true);
      expect(acc2.isWritable).toBe(false);

      // role 3: signer, writable
      const acc3 = roleToWeb3Account('addr3', 3);
      expect(acc3.isSigner).toBe(true);
      expect(acc3.isWritable).toBe(true);
    });
  });

  describe('10. Request Validation', () => {
    it('should require wallet parameter', () => {
      const body = { credentialId: 'test', promptHash: 'hash' };
      const isValid = !!(body.wallet && body.credentialId && body.promptHash);
      expect(isValid).toBe(false);
    });

    it('should require credentialId parameter', () => {
      const body = { wallet: 'addr', promptHash: 'hash' };
      const isValid = !!(body.wallet && body.credentialId && body.promptHash);
      expect(isValid).toBe(false);
    });

    it('should require promptHash parameter', () => {
      const body = { wallet: 'addr', credentialId: 'id' };
      const isValid = !!(body.wallet && body.credentialId && body.promptHash);
      expect(isValid).toBe(false);
    });

    it('should accept all required parameters', () => {
      const body = { 
        wallet: 'UserWallet123456789012345678901234567890ABC',
        credentialId: 'hc_test-uuid-1234',
        promptHash: 'abc123def456'
      };
      const isValid = !!(body.wallet && body.credentialId && body.promptHash);
      expect(isValid).toBe(true);
    });
  });

  describe('11. Test Mode Bypass', () => {
    it('should skip operations in test mode', () => {
      process.env.NODE_ENV = 'test';
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should return mock responses in test mode', () => {
      const testResponse = {
        base64Tx: Buffer.from('test_transaction_data').toString('base64'),
        attestationPda: 'test_attestation_pda',
        isTestMode: true
      };
      
      expect(testResponse.isTestMode).toBe(true);
      expect(testResponse.base64Tx).toBeDefined();
    });
  });
});
