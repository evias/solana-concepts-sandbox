// Mock setup BEFORE any requires
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(() => ({
    getBalance: jest.fn().mockResolvedValue(10000000),
    requestAirdrop: jest.fn(),
    confirmTransaction: jest.fn()
  })),
  Keypair: {
    generate: jest.fn(() => ({
      publicKey: {
        toBase58: jest.fn(() => 'payer-public-key-base58')
      },
      secretKey: new Uint8Array(64)
    })),
    fromSecretKey: jest.fn((secretKey) => ({
      publicKey: {
        toBase58: jest.fn(() => 'payer-public-key-base58')
      },
      secretKey: secretKey
    }))
  },
  PublicKey: jest.fn((address) => ({
    toBase58: jest.fn(() => address)
  }))
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn()
}));

jest.mock('@solana/spl-token', () => ({
  createMint: jest.fn(),
  getOrCreateAssociatedTokenAccount: jest.fn(),
  mintTo: jest.fn(),
  getMint: jest.fn(),
  getAccount: jest.fn()
}));

const splToken = require('@solana/spl-token');
const web3 = require('@solana/web3.js');

// Import the module to test after mocking
const {
  createPetTokenMint,
  createAssociatedTokenAccount,
  mintPetToken,
  getTokenInfo,
  getTokenAccountBalance
} = require('../api/solana-tokens');

describe('Solana Token Operations', () => {
  let ownerPublicKey;

  beforeEach(() => {
    jest.clearAllMocks();
    ownerPublicKey = {
      toBase58: jest.fn(() => 'owner-public-key-base58')
    };
  });

  describe('createPetTokenMint', () => {
    test('should create a token mint successfully', async () => {
      // Arrange
      const mockMintAddress = {
        toBase58: jest.fn(() => 'mint-address-base58')
      };
      
      web3.Keypair.generate.mockReturnValue({
        publicKey: {
          toBase58: jest.fn(() => 'payer-key')
        }
      });

      splToken.createMint.mockResolvedValue(mockMintAddress);

      // Act
      const result = await createPetTokenMint(ownerPublicKey);

      // Assert
      expect(result.success).toBe(true);
      expect(result.mintAddress).toBe('mint-address-base58');
      expect(splToken.createMint).toHaveBeenCalled();
    });

    test('should call createMint with correct parameters', async () => {
      // Arrange
      const mockMintAddress = {
        toBase58: jest.fn(() => 'mint-address-base58')
      };
      
      splToken.createMint.mockResolvedValue(mockMintAddress);

      // Act
      await createPetTokenMint(ownerPublicKey);

      // Assert
      expect(splToken.createMint).toHaveBeenCalledWith(
        expect.anything(), // connection
        expect.anything(), // payer
        expect.anything(), // mint authority (payer, not owner)
        expect.anything(), // freeze authority (payer, not owner)
        0                  // decimals
      );
    });

    test('should handle createMint errors gracefully', async () => {
      // Arrange
      const error = new Error('Mint creation failed');
      splToken.createMint.mockRejectedValue(error);

      // Act & Assert
      await expect(createPetTokenMint(ownerPublicKey)).rejects.toThrow('Mint creation failed');
    });

    test('should use 0 decimals for pet tokens', async () => {
      // Arrange
      const mockMintAddress = {
        toBase58: jest.fn(() => 'mint-address')
      };
      splToken.createMint.mockResolvedValue(mockMintAddress);

      // Act
      await createPetTokenMint(ownerPublicKey);

      // Assert
      const callArgs = splToken.createMint.mock.calls[0];
      expect(callArgs[4]).toBe(0); // decimals parameter
    });

    test('should return an object with success flag and mintAddress', async () => {
      // Arrange
      const mockMintAddress = {
        toBase58: jest.fn(() => 'new-mint-address')
      };
      splToken.createMint.mockResolvedValue(mockMintAddress);

      // Act
      const result = await createPetTokenMint(ownerPublicKey);

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('mintAddress');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.mintAddress).toBe('string');
    });
  });

  describe('createAssociatedTokenAccount', () => {
    test('should create or get associated token account successfully', async () => {
      // Arrange
      const mockTokenAccount = {
        address: {
          toBase58: jest.fn(() => 'token-account-address')
        }
      };
      
      splToken.getOrCreateAssociatedTokenAccount.mockResolvedValue(mockTokenAccount);

      // Act
      const result = await createAssociatedTokenAccount(ownerPublicKey, 'mint-address');

      // Assert
      expect(result.success).toBe(true);
      expect(result.tokenAccount).toBe('token-account-address');
    });

    test('should call getOrCreateAssociatedTokenAccount with correct parameters', async () => {
      // Arrange
      const mockTokenAccount = {
        address: {
          toBase58: jest.fn(() => 'token-account')
        }
      };
      
      splToken.getOrCreateAssociatedTokenAccount.mockResolvedValue(mockTokenAccount);

      // Act
      await createAssociatedTokenAccount(ownerPublicKey, 'mint-address');

      // Assert
      expect(splToken.getOrCreateAssociatedTokenAccount).toHaveBeenCalledWith(
        expect.anything(), // connection
        expect.anything(), // payer
        expect.anything(), // mint address (PublicKey)
        ownerPublicKey     // owner
      );
    });

    test('should handle errors gracefully', async () => {
      // Arrange
      const error = new Error('Token account creation failed');
      splToken.getOrCreateAssociatedTokenAccount.mockRejectedValue(error);

      // Act & Assert
      await expect(createAssociatedTokenAccount(ownerPublicKey, 'mint-address')).rejects.toThrow('Token account creation failed');
    });

    test('should return an object with success flag and tokenAccount', async () => {
      // Arrange
      const mockTokenAccount = {
        address: {
          toBase58: jest.fn(() => 'ata-address')
        }
      };
      
      splToken.getOrCreateAssociatedTokenAccount.mockResolvedValue(mockTokenAccount);

      // Act
      const result = await createAssociatedTokenAccount(ownerPublicKey, 'mint-addr');

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('tokenAccount');
      expect(result.success).toBe(true);
    });
  });

  describe('mintPetToken', () => {
    test('should mint pet token successfully', async () => {
      // Arrange
      splToken.mintTo.mockResolvedValue('transaction-signature');

      // Act
      const result = await mintPetToken('mint-address', 'token-account-address', ownerPublicKey);

      // Assert
      expect(result.success).toBe(true);
      expect(result.signature).toBe('transaction-signature');
    });

    test('should call mintTo with correct amount (1)', async () => {
      // Arrange
      splToken.mintTo.mockResolvedValue('sig-123');

      // Act
      await mintPetToken('mint-address', 'token-account-address', ownerPublicKey);

      // Assert
      const callArgs = splToken.mintTo.mock.calls[0];
      expect(callArgs[5]).toBe(1); // amount (6th parameter)
      expect(splToken.mintTo).toHaveBeenCalled();
    });

    test('should always mint exactly 1 token', async () => {
      // Arrange
      splToken.mintTo.mockResolvedValue('sig-456');

      // Act
      await mintPetToken('mint-addr-1', 'token-account-1', ownerPublicKey);
      await mintPetToken('mint-addr-2', 'token-account-2', ownerPublicKey);

      // Assert
      expect(splToken.mintTo).toHaveBeenCalledTimes(2);
      expect(splToken.mintTo.mock.calls[0][5]).toBe(1);
      expect(splToken.mintTo.mock.calls[1][5]).toBe(1);
    });

    test('should handle minting errors', async () => {
      // Arrange
      const error = new Error('Minting failed');
      splToken.mintTo.mockRejectedValue(error);

      // Act & Assert
      await expect(mintPetToken('mint-addr', 'token-account', ownerPublicKey)).rejects.toThrow('Minting failed');
    });

    test('should return transaction signature', async () => {
      // Arrange
      const expectedSignature = 'unique-transaction-signature-xyz789';
      splToken.mintTo.mockResolvedValue(expectedSignature);

      // Act
      const result = await mintPetToken('mint-addr', 'token-account', ownerPublicKey);

      // Assert
      expect(result.signature).toBe(expectedSignature);
    });
  });

  describe('getTokenInfo', () => {
    test('should retrieve token information successfully', async () => {
      // Arrange
      const mockMintInfo = {
        supply: {
          toString: jest.fn(() => '1')
        },
        decimals: 0,
        isInitialized: true,
        owner: {
          toBase58: jest.fn(() => 'owner-address')
        }
      };

      splToken.getMint.mockResolvedValue(mockMintInfo);

      // Act
      const result = await getTokenInfo('mint-address');

      // Assert
      expect(result.supply).toBe('1');
      expect(result.decimals).toBe(0);
      expect(result.isInitialized).toBe(true);
      expect(result.owner).toBe('owner-address');
    });

    test('should handle getMint errors', async () => {
      // Arrange
      const error = new Error('Token not found');
      splToken.getMint.mockRejectedValue(error);

      // Act & Assert
      await expect(getTokenInfo('invalid-mint')).rejects.toThrow('Token not found');
    });

    test('should return supply as string', async () => {
      // Arrange
      const mockMintInfo = {
        supply: {
          toString: jest.fn(() => '1000000000')
        },
        decimals: 6,
        isInitialized: true,
        owner: {
          toBase58: jest.fn(() => 'owner')
        }
      };

      splToken.getMint.mockResolvedValue(mockMintInfo);

      // Act
      const result = await getTokenInfo('mint-addr');

      // Assert
      expect(result.supply).toBe('1000000000');
      expect(typeof result.supply).toBe('string');
    });

    test('should include all token properties', async () => {
      // Arrange
      const mockMintInfo = {
        supply: { toString: jest.fn(() => '500') },
        decimals: 2,
        isInitialized: true,
        owner: { toBase58: jest.fn(() => 'owner-addr') }
      };

      splToken.getMint.mockResolvedValue(mockMintInfo);

      // Act
      const result = await getTokenInfo('mint-addr');

      // Assert
      expect(result).toHaveProperty('supply');
      expect(result).toHaveProperty('decimals');
      expect(result).toHaveProperty('isInitialized');
      expect(result).toHaveProperty('owner');
    });
  });

  describe('getTokenAccountBalance', () => {
    test('should retrieve token account balance successfully', async () => {
      // Arrange
      const mockAccount = {
        amount: {
          toString: jest.fn(() => '1')
        },
        decimals: 0,
        owner: {
          toBase58: jest.fn(() => 'account-owner')
        },
        mint: {
          toBase58: jest.fn(() => 'mint-address')
        }
      };

      splToken.getAccount.mockResolvedValue(mockAccount);

      // Act
      const result = await getTokenAccountBalance('token-account-address');

      // Assert
      expect(result.amount).toBe('1');
      expect(result.decimals).toBe(0);
      expect(result.owner).toBe('account-owner');
      expect(result.mint).toBe('mint-address');
    });

    test('should handle getAccount errors', async () => {
      // Arrange
      const error = new Error('Account not found');
      splToken.getAccount.mockRejectedValue(error);

      // Act & Assert
      await expect(getTokenAccountBalance('invalid-account')).rejects.toThrow('Account not found');
    });

    test('should return amount as string', async () => {
      // Arrange
      const mockAccount = {
        amount: { toString: jest.fn(() => '5000000000') },
        decimals: 9,
        owner: { toBase58: jest.fn(() => 'owner') },
        mint: { toBase58: jest.fn(() => 'mint') }
      };

      splToken.getAccount.mockResolvedValue(mockAccount);

      // Act
      const result = await getTokenAccountBalance('token-account');

      // Assert
      expect(result.amount).toBe('5000000000');
      expect(typeof result.amount).toBe('string');
    });

    test('should include all account properties', async () => {
      // Arrange
      const mockAccount = {
        amount: { toString: jest.fn(() => '100') },
        decimals: 8,
        owner: { toBase58: jest.fn(() => 'owner-addr') },
        mint: { toBase58: jest.fn(() => 'mint-addr') }
      };

      splToken.getAccount.mockResolvedValue(mockAccount);

      // Act
      const result = await getTokenAccountBalance('token-account');

      // Assert
      expect(result).toHaveProperty('amount');
      expect(result).toHaveProperty('decimals');
      expect(result).toHaveProperty('owner');
      expect(result).toHaveProperty('mint');
    });

    test('should handle accounts with zero balance', async () => {
      // Arrange
      const mockAccount = {
        amount: { toString: jest.fn(() => '0') },
        decimals: 0,
        owner: { toBase58: jest.fn(() => 'owner') },
        mint: { toBase58: jest.fn(() => 'mint') }
      };

      splToken.getAccount.mockResolvedValue(mockAccount);

      // Act
      const result = await getTokenAccountBalance('empty-token-account');

      // Assert
      expect(result.amount).toBe('0');
    });
  });

  describe('Integration scenarios', () => {
    test('should create mint, associated account, and mint token in sequence', async () => {
      // Arrange
      const mockMint = { toBase58: jest.fn(() => 'mint-addr') };
      const mockTokenAccount = { address: { toBase58: jest.fn(() => 'token-account-addr') } };

      splToken.createMint.mockResolvedValue(mockMint);
      splToken.getOrCreateAssociatedTokenAccount.mockResolvedValue(mockTokenAccount);
      splToken.mintTo.mockResolvedValue('mint-sig');

      // Act
      const mintResult = await createPetTokenMint(ownerPublicKey);
      const accountResult = await createAssociatedTokenAccount(ownerPublicKey, mintResult.mintAddress);
      const mintTokenResult = await mintPetToken(mintResult.mintAddress, accountResult.tokenAccount, ownerPublicKey);

      // Assert
      expect(mintResult.success).toBe(true);
      expect(accountResult.success).toBe(true);
      expect(mintTokenResult.success).toBe(true);
    });

    test('should handle multiple pets being registered', async () => {
      // Arrange
      const mockMint1 = { toBase58: jest.fn(() => 'mint-1') };
      const mockMint2 = { toBase58: jest.fn(() => 'mint-2') };

      splToken.createMint
        .mockResolvedValueOnce(mockMint1)
        .mockResolvedValueOnce(mockMint2);

      splToken.getOrCreateAssociatedTokenAccount.mockResolvedValue({
        address: { toBase58: jest.fn(() => 'token-account') }
      });

      splToken.mintTo.mockResolvedValue('sig');

      // Act
      const pet1 = await createPetTokenMint(ownerPublicKey);
      const pet2 = await createPetTokenMint(ownerPublicKey);

      // Assert
      expect(pet1.mintAddress).toBe('mint-1');
      expect(pet2.mintAddress).toBe('mint-2');
      expect(splToken.createMint).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    test('should handle very large supply numbers', async () => {
      // Arrange
      const mockMintInfo = {
        supply: { toString: jest.fn(() => '9223372036854775807') }, // Max safe integer
        decimals: 0,
        isInitialized: true,
        owner: { toBase58: jest.fn(() => 'owner') }
      };

      splToken.getMint.mockResolvedValue(mockMintInfo);

      // Act
      const result = await getTokenInfo('mint-addr');

      // Assert
      expect(result.supply).toBe('9223372036854775807');
    });

    test('should handle uninitialized tokens', async () => {
      // Arrange
      const mockMintInfo = {
        supply: { toString: jest.fn(() => '0') },
        decimals: 0,
        isInitialized: false,
        owner: { toBase58: jest.fn(() => '') }
      };

      splToken.getMint.mockResolvedValue(mockMintInfo);

      // Act
      const result = await getTokenInfo('mint-addr');

      // Assert
      expect(result.isInitialized).toBe(false);
      expect(result.supply).toBe('0');
    });
  });
});
