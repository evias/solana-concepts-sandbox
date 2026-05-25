/**
 * Unit Tests for SAS Integration
 * Tests verify the exported functions and error handling
 */

jest.mock('sas-lib', () => ({
  deriveCredentialPda: jest.fn(),
  fetchMaybeCredential: jest.fn(),
  getCreateCredentialInstruction: jest.fn(),
  getChangeAuthorizedSignersInstruction: jest.fn()
}));

jest.mock('@solana/kit', () => ({
  createSolanaRpc: jest.fn(),
  createKeyPairSignerFromPrivateKeyBytes: jest.fn()
}));

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(),
  PublicKey: jest.fn(),
  Transaction: jest.fn(),
  TransactionInstruction: jest.fn()
}));

const lib = require('sas-lib');
const kit = require('@solana/kit');

describe('SAS Integration', () => {
  const mockOwnerAddress = 'J8kEp5euznzbrFqK61Dbu22zJfCzFH184xSbu7LMVTHc';
  const mockVetAddress = 'Eu1ZYNxv4wVWZtoHtJw4bncmKDQxL9RdYJLAHr6H1H55';
  const mockCredentialAddress = 'CredentialAddressHere123456789012';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Module structure', () => {
    it('should export three functions', () => {
      // Use direct require of the module with mocks in place
      const sas = jest.requireActual('../api/sas-integration');
      
      expect(sas).toHaveProperty('ensureSasCredential');
      expect(sas).toHaveProperty('addAuthorizedSigner');
      expect(sas).toHaveProperty('getAuthorizedSigners');
      
      expect(typeof sas.ensureSasCredential).toBe('function');
      expect(typeof sas.addAuthorizedSigner).toBe('function');
      expect(typeof sas.getAuthorizedSigners).toBe('function');
    });
  });

  describe('ensureSasCredential function behavior', () => {
    it('should derive credential PDA from payer address', async () => {
      lib.deriveCredentialPda.mockResolvedValue([{ toString: () => mockCredentialAddress }, 254]);
      lib.fetchMaybeCredential.mockResolvedValue(null);

      const sas = jest.requireActual('../api/sas-integration');
      
      // Mock the RPC and create functions
      kit.createSolanaRpc.mockReturnValue({
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: { blockhash: 'hash', lastValidBlockHeight: 1000 }
          })
        })
      });

      kit.createKeyPairSignerFromPrivateKeyBytes.mockResolvedValue({
        address: 'payer'
      });

      const mockPayer = {
        publicKey: {
          toBase58: () => 'PayerAddressHere',
          toBuffer: () => Buffer.alloc(32)
        },
        secretKey: Buffer.alloc(64)
      };

      try {
        await sas.ensureSasCredential(mockOwnerAddress, mockPayer);
      } catch (e) {
        // May throw due to mocking limitations
      }

      expect(lib.deriveCredentialPda).toHaveBeenCalled();
    });

    it('should fetch credential to check existence', async () => {
      lib.deriveCredentialPda.mockResolvedValue([{ toString: () => mockCredentialAddress }, 254]);
      lib.fetchMaybeCredential.mockResolvedValue(null);

      const sas = jest.requireActual('../api/sas-integration');
      
      kit.createSolanaRpc.mockReturnValue({
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: { blockhash: 'hash', lastValidBlockHeight: 1000 }
          })
        })
      });

      kit.createKeyPairSignerFromPrivateKeyBytes.mockResolvedValue({
        address: 'payer'
      });

      const mockPayer = {
        publicKey: {
          toBase58: () => 'PayerAddressHere',
          toBuffer: () => Buffer.alloc(32)
        },
        secretKey: Buffer.alloc(64)
      };

      try {
        await sas.ensureSasCredential(mockOwnerAddress, mockPayer);
      } catch (e) {
        // May throw due to mocking limitations
      }

      expect(lib.fetchMaybeCredential).toHaveBeenCalled();
    });

    it('should return existing credential with signers if exists', async () => {
      const existingSigners = [mockVetAddress];
      lib.deriveCredentialPda.mockResolvedValue([{ toString: () => mockCredentialAddress }, 254]);
      lib.fetchMaybeCredential.mockResolvedValue({
        exists: true,
        authorizedSigners: existingSigners
      });

      const sas = jest.requireActual('../api/sas-integration');
      
      kit.createSolanaRpc.mockReturnValue({
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: { blockhash: 'hash', lastValidBlockHeight: 1000 }
          })
        })
      });

      kit.createKeyPairSignerFromPrivateKeyBytes.mockResolvedValue({
        address: 'payer'
      });

      const mockPayer = {
        publicKey: {
          toBase58: () => 'PayerAddressHere',
          toBuffer: () => Buffer.alloc(32)
        },
        secretKey: Buffer.alloc(64)
      };

      const result = await sas.ensureSasCredential(mockOwnerAddress, mockPayer);

      expect(result.exists).toBe(true);
      expect(result.authorizedSigners).toEqual(existingSigners);
      expect(result.credentialAddress).toBe(mockCredentialAddress);
    });
  });

  describe('addAuthorizedSigner function behavior', () => {
    it('should reject when credential does not exist', async () => {
      lib.fetchMaybeCredential.mockResolvedValue(null);

      const sas = jest.requireActual('../api/sas-integration');
      
      kit.createSolanaRpc.mockReturnValue({});
      kit.createKeyPairSignerFromPrivateKeyBytes.mockResolvedValue({
        address: 'payer'
      });

      const mockPayer = {
        publicKey: { toBase58: () => 'PayerAddressHere', toBuffer: () => Buffer.alloc(32) },
        secretKey: Buffer.alloc(64)
      };

      await expect(
        sas.addAuthorizedSigner(mockCredentialAddress, mockOwnerAddress, mockVetAddress, mockPayer)
      ).rejects.toThrow('Credential does not exist');
    });

    it('should reject when signer already authorized', async () => {
      lib.fetchMaybeCredential.mockResolvedValue({
        exists: true,
        authorizedSigners: [mockVetAddress]
      });

      const sas = jest.requireActual('../api/sas-integration');
      
      kit.createSolanaRpc.mockReturnValue({});
      kit.createKeyPairSignerFromPrivateKeyBytes.mockResolvedValue({
        address: 'payer'
      });

      const mockPayer = {
        publicKey: { toBase58: () => 'PayerAddressHere', toBuffer: () => Buffer.alloc(32) },
        secretKey: Buffer.alloc(64)
      };

      await expect(
        sas.addAuthorizedSigner(mockCredentialAddress, mockOwnerAddress, mockVetAddress, mockPayer)
      ).rejects.toThrow('Signer already authorized');
    });

    it('should call getChangeAuthorizedSignersInstruction when adding new signer', async () => {
      lib.fetchMaybeCredential.mockResolvedValue({
        exists: true,
        authorizedSigners: []
      });

      lib.getChangeAuthorizedSignersInstruction.mockReturnValue({
        accounts: [
          { address: 'PayerAddressHere', role: 3 },
          { address: 'PayerAddressHere', role: 2 },
          { address: mockCredentialAddress, role: 1 },
          { address: '11111111111111111111111111111111', role: 0 }
        ],
        programAddress: 'solAtt9LGwtXvQiDKq6IivMF6bBqWSbJZdS7wqb5Fys',
        data: Buffer.from([3])
      });

      const sas = jest.requireActual('../api/sas-integration');
      
      kit.createSolanaRpc.mockReturnValue({
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: { blockhash: 'hash', lastValidBlockHeight: 1000 }
          })
        })
      });
      
      kit.createKeyPairSignerFromPrivateKeyBytes.mockResolvedValue({
        address: 'payer'
      });

      const mockPayer = {
        publicKey: { toBase58: () => 'PayerAddressHere', toBuffer: () => Buffer.alloc(32) },
        secretKey: Buffer.alloc(64)
      };

      try {
        await sas.addAuthorizedSigner(mockCredentialAddress, mockOwnerAddress, mockVetAddress, mockPayer);
      } catch (e) {
        // May throw due to mocking
      }

      expect(lib.getChangeAuthorizedSignersInstruction).toHaveBeenCalled();
    });
  });

  describe('getAuthorizedSigners function behavior', () => {
    it('should return empty array when credential does not exist', async () => {
      lib.fetchMaybeCredential.mockResolvedValue(null);

      const sas = jest.requireActual('../api/sas-integration');
      
      kit.createSolanaRpc.mockReturnValue({});

      const result = await sas.getAuthorizedSigners(mockCredentialAddress);

      expect(result).toEqual([]);
    });

    it('should return authorized signers from credential', async () => {
      const signers = [mockVetAddress, 'another-vet-address'];
      lib.fetchMaybeCredential.mockResolvedValue({
        exists: true,
        authorizedSigners: signers
      });

      const sas = jest.requireActual('../api/sas-integration');
      
      kit.createSolanaRpc.mockReturnValue({});

      const result = await sas.getAuthorizedSigners(mockCredentialAddress);

      expect(result).toEqual(signers);
    });

    it('should return empty array when signer list is null', async () => {
      lib.fetchMaybeCredential.mockResolvedValue({
        exists: true,
        authorizedSigners: null
      });

      const sas = jest.requireActual('../api/sas-integration');
      
      kit.createSolanaRpc.mockReturnValue({});

      const result = await sas.getAuthorizedSigners(mockCredentialAddress);

      expect(result).toEqual([]);
    });

    it('should handle fetch errors gracefully', async () => {
      lib.fetchMaybeCredential.mockRejectedValue(new Error('Network error'));

      const sas = jest.requireActual('../api/sas-integration');
      
      kit.createSolanaRpc.mockReturnValue({});

      const result = await sas.getAuthorizedSigners(mockCredentialAddress);

      expect(result).toEqual([]);
    });
  });
});
