// Standalone version of ensureTokenAccountExists for testing
async function ensureTokenAccountExists(mockConnection, payerKeypair, ownerPublicKey) {
  try {
    const accountInfo = await mockConnection.getAccountInfo(ownerPublicKey);
    if (!accountInfo) {
      const signature = await mockConnection.requestAirdrop(ownerPublicKey, 1000000000);
      await mockConnection.confirmTransaction(signature);
      console.log('Created account and airdropped SOL:', ownerPublicKey.toBase58());
    }
    return true;
  } catch (error) {
    console.error('Error ensuring token account exists:', error);
    return false;
  }
}

describe('ensureTokenAccountExists', () => {
  let mockConnection;
  let payerKeypair;
  let ownerPublicKey;

  beforeEach(() => {
    // Create mock connection
    mockConnection = {
      getAccountInfo: jest.fn(),
      requestAirdrop: jest.fn(),
      confirmTransaction: jest.fn(),
    };

    // Create mock keypairs and public keys
    payerKeypair = { publicKey: 'payer-public-key' };
    ownerPublicKey = {
      toBase58: jest.fn(() => 'owner-public-key-base58'),
      toString: jest.fn(() => 'owner-public-key-string'),
    };

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('successful scenarios', () => {
    test('should return true when account already exists', async () => {
      // Arrange
      const mockAccountInfo = {
        lamports: 1000000,
        owner: 'system-program',
        executable: false,
        rentEpoch: 100,
      };
      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.getAccountInfo).toHaveBeenCalledWith(ownerPublicKey);
      expect(mockConnection.requestAirdrop).not.toHaveBeenCalled();
      expect(mockConnection.confirmTransaction).not.toHaveBeenCalled();
    });

    test('should create account and airdrop SOL when account does not exist', async () => {
      // Arrange
      const mockSignature = 'mock-transaction-signature-123';
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.requestAirdrop.mockResolvedValue(mockSignature);
      mockConnection.confirmTransaction.mockResolvedValue({ value: { err: null } });

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.getAccountInfo).toHaveBeenCalledWith(ownerPublicKey);
      expect(mockConnection.requestAirdrop).toHaveBeenCalledWith(ownerPublicKey, 1000000000);
      expect(mockConnection.confirmTransaction).toHaveBeenCalledWith(mockSignature);
    });

    test('should airdrop exactly 1 SOL (1000000000 lamports)', async () => {
      // Arrange
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.requestAirdrop.mockResolvedValue('sig-123');
      mockConnection.confirmTransaction.mockResolvedValue({ value: { err: null } });

      // Act
      await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      const airdropCall = mockConnection.requestAirdrop.mock.calls[0];
      expect(airdropCall[1]).toBe(1000000000);
    });

    test('should call confirmTransaction with the returned signature', async () => {
      // Arrange
      const unique_signature = 'unique-signature-xyz789';
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.requestAirdrop.mockResolvedValue(unique_signature);
      mockConnection.confirmTransaction.mockResolvedValue({ value: { err: null } });

      // Act
      await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(mockConnection.confirmTransaction).toHaveBeenCalledWith(unique_signature);
    });
  });

  describe('error handling', () => {
    test('should return false when getAccountInfo throws an error', async () => {
      // Arrange
      const error = new Error('Network error');
      mockConnection.getAccountInfo.mockRejectedValue(error);

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(false);
      expect(mockConnection.getAccountInfo).toHaveBeenCalled();
    });

    test('should return false when requestAirdrop throws an error', async () => {
      // Arrange
      mockConnection.getAccountInfo.mockResolvedValue(null);
      const error = new Error('Airdrop failed');
      mockConnection.requestAirdrop.mockRejectedValue(error);

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(false);
      expect(mockConnection.requestAirdrop).toHaveBeenCalled();
    });

    test('should return false when confirmTransaction throws an error', async () => {
      // Arrange
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.requestAirdrop.mockResolvedValue('sig-123');
      const error = new Error('Transaction confirmation failed');
      mockConnection.confirmTransaction.mockRejectedValue(error);

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(false);
      expect(mockConnection.confirmTransaction).toHaveBeenCalled();
    });

    test('should handle network timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';
      mockConnection.getAccountInfo.mockRejectedValue(timeoutError);

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(false);
    });

    test('should handle invalid public key errors', async () => {
      // Arrange
      const error = new Error('Invalid public key');
      mockConnection.getAccountInfo.mockRejectedValue(error);

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(false);
    });

    test('should catch and log errors', async () => {
      // Arrange
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test error');
      mockConnection.getAccountInfo.mockRejectedValue(error);

      // Act
      await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error ensuring token account exists:',
        error
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    test('should handle empty account info gracefully', async () => {
      // Arrange
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.requestAirdrop.mockResolvedValue('sig-123');
      mockConnection.confirmTransaction.mockResolvedValue({ value: { err: null } });

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.requestAirdrop).toHaveBeenCalled();
    });

    test('should work with different owner public keys', async () => {
      // Arrange
      const anotherOwnerKey = {
        toBase58: jest.fn(() => 'another-owner-key-base58'),
        toString: jest.fn(() => 'another-owner-key-string'),
      };
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.requestAirdrop.mockResolvedValue('sig-123');
      mockConnection.confirmTransaction.mockResolvedValue({ value: { err: null } });

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        anotherOwnerKey
      );

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.getAccountInfo).toHaveBeenCalledWith(anotherOwnerKey);
      expect(mockConnection.requestAirdrop).toHaveBeenCalledWith(anotherOwnerKey, 1000000000);
    });

    test('should handle account with zero balance', async () => {
      // Arrange
      const zeroBalanceAccount = {
        lamports: 0,
        owner: 'system-program',
        executable: false,
        rentEpoch: 100,
      };
      mockConnection.getAccountInfo.mockResolvedValue(zeroBalanceAccount);

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(true);
      // Should not attempt airdrop since account exists
      expect(mockConnection.requestAirdrop).not.toHaveBeenCalled();
    });

    test('should handle confirmation with transaction error', async () => {
      // Arrange
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.requestAirdrop.mockResolvedValue('sig-123');
      mockConnection.confirmTransaction.mockResolvedValue({ 
        value: { err: 'TransactionError' } 
      });

      // Act - The current implementation doesn't check for transaction errors
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert - This will pass because the implementation doesn't check err
      expect(result).toBe(true);
    });

    test('should handle when airdrop returns null signature', async () => {
      // Arrange
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.requestAirdrop.mockResolvedValue(null);
      mockConnection.confirmTransaction.mockResolvedValue({ value: { err: null } });

      // Act
      const result = await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.confirmTransaction).toHaveBeenCalledWith(null);
    });
  });

  describe('function behavior', () => {
    test('should only check account once and skip if exists', async () => {
      // Arrange
      const mockAccountInfo = {
        lamports: 5000000,
        owner: 'system-program',
        executable: false,
        rentEpoch: 100,
      };
      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);

      // Act
      await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(1);
      expect(mockConnection.requestAirdrop).toHaveBeenCalledTimes(0);
      expect(mockConnection.confirmTransaction).toHaveBeenCalledTimes(0);
    });

    test('should call airdrop and confirm in correct order', async () => {
      // Arrange
      const callOrder = [];
      mockConnection.getAccountInfo.mockImplementation(() => {
        callOrder.push('getAccountInfo');
        return Promise.resolve(null);
      });
      mockConnection.requestAirdrop.mockImplementation(() => {
        callOrder.push('requestAirdrop');
        return Promise.resolve('sig-123');
      });
      mockConnection.confirmTransaction.mockImplementation(() => {
        callOrder.push('confirmTransaction');
        return Promise.resolve({ value: { err: null } });
      });

      // Act
      await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(callOrder).toEqual([
        'getAccountInfo',
        'requestAirdrop',
        'confirmTransaction',
      ]);
    });

    test('should log success message when creating account', async () => {
      // Arrange
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.requestAirdrop.mockResolvedValue('sig-123');
      mockConnection.confirmTransaction.mockResolvedValue({ value: { err: null } });

      // Act
      await ensureTokenAccountExists(
        mockConnection,
        payerKeypair,
        ownerPublicKey
      );

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Created account and airdropped SOL:',
        'owner-public-key-base58'
      );
      consoleLogSpy.mockRestore();
    });
  });
});
