/**
 * HealthCred Transaction Deserialization Tests
 * Verify that transaction encoding/decoding works for frontend
 */

describe('HealthCred Transaction Deserialization', () => {
  // Polyfill for Uint8Array.fromBase64 (browser API not available in Node.js)
  const fromBase64 = (str) => {
    if (Uint8Array.fromBase64) {
      return Uint8Array.fromBase64(str);
    }
    // Node.js fallback
    return new Uint8Array(Buffer.from(str, 'base64'));
  };

  test('base64 transaction from backend can be decoded to Uint8Array', () => {
    // Simulate backend serialization
    const sampleData = Buffer.from('Hello, Solana!');
    const base64Tx = sampleData.toString('base64');
    
    console.log('Original data:', sampleData);
    console.log('Base64 encoded:', base64Tx);
    
    // Simulate frontend decoding
    const decoded = new Uint8Array(fromBase64(base64Tx));
    
    console.log('Decoded:', decoded);
    console.log('Decoded length:', decoded.length);
    
    expect(decoded).toHaveLength(sampleData.length);
    expect(Array.from(decoded)).toEqual(Array.from(sampleData));
  });

  test('backend /badges returns decodable base64 transaction', () => {
    // Simulate what the backend does
    const mockTx = Buffer.from('mock_transaction_data_' + Date.now());
    const base64Tx = mockTx.toString('base64');
    
    console.log('Mock transaction base64:', base64Tx);
    console.log('Mock transaction base64 length:', base64Tx.length);
    
    // Verify it's valid base64
    expect(base64Tx).toMatch(/^[A-Za-z0-9+/=]*$/);
    
    // Verify frontend can decode it
    const decoded = new Uint8Array(fromBase64(base64Tx));
    expect(decoded.length).toBeGreaterThan(0);
    expect(Array.from(decoded)).toEqual(Array.from(mockTx));
  });

  test('transaction round-trip: Buffer → base64 → Uint8Array', () => {
    // This is the exact flow: backend serializes → sends base64 → frontend deserializes
    
    // Backend: Create buffer and encode to base64
    const backendBuffer = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const base64String = backendBuffer.toString('base64');
    
    console.log('Backend buffer:', Array.from(backendBuffer));
    console.log('Base64 string:', base64String);
    
    // Frontend: Receive base64 and decode to Uint8Array
    const frontendUint8Array = new Uint8Array(fromBase64(base64String));
    
    console.log('Frontend Uint8Array:', Array.from(frontendUint8Array));
    
    // Verify they match
    expect(Array.from(frontendUint8Array)).toEqual(Array.from(backendBuffer));
  });

  test('badge API response has valid decodable transaction', () => {
    // Simulate what the /badges endpoint returns
    const txBuffer = Buffer.from('badge_tx_data_' + Date.now());
    const badgeResponse = {
      success: true,
      badgeRegistrationId: 'badge_reg_123',
      transaction: txBuffer.toString('base64'),
      metadata: {
        credentialId: 'cred_123',
        issuerWallet: '9B5X4bq1q1pYzEV3SRsLKNh5D2aJDgGMfVqG6v4bJRsV',
        emoji: '⭐',
        description: 'Test badge',
        mint: 'DGLzb1HUJ6Qg1G1yi4FgW1ZeGpNMVXQmkvRR98cKFhJk'
      }
    };
    
    // Frontend checks
    expect(badgeResponse.badgeRegistrationId).toBeDefined();
    expect(badgeResponse.transaction).toBeDefined();
    
    // Verify transaction is valid base64
    expect(badgeResponse.transaction).toMatch(/^[A-Za-z0-9+/=]*$/);
    
    // CRITICAL TEST: Frontend can decode it
    const decoded = new Uint8Array(fromBase64(badgeResponse.transaction));
    expect(decoded.length).toBeGreaterThan(0);
    expect(Array.from(decoded)).toEqual(Array.from(txBuffer));
  });

  test('certification API response has valid decodable transaction', () => {
    // Simulate what the /certifications endpoint returns
    const txBuffer = Buffer.from('cert_tx_data_' + Date.now());
    const certResponse = {
      success: true,
      certificationRegistrationId: 'cert_reg_123',
      transaction: txBuffer.toString('base64'),
      metadata: {
        credentialId: 'cred_123',
        issuerWallet: '9B5X4bq1q1pYzEV3SRsLKNh5D2aJDgGMfVqG6v4bJRsV',
        filename: 'test.pdf',
        mint: 'DGLzb1HUJ6Qg1G1yi4FgW1ZeGpNMVXQmkvRR98cKFhJk'
      }
    };
    
    expect(certResponse.certificationRegistrationId).toBeDefined();
    expect(certResponse.transaction).toBeDefined();
    
    // Verify transaction is valid base64
    expect(certResponse.transaction).toMatch(/^[A-Za-z0-9+/=]*$/);
    
    // CRITICAL TEST: Frontend can decode it
    const decoded = new Uint8Array(fromBase64(certResponse.transaction));
    expect(decoded.length).toBeGreaterThan(0);
    expect(Array.from(decoded)).toEqual(Array.from(txBuffer));
  });

  test('registration API response has valid decodable transaction', () => {
    // Simulate what the /register endpoint returns
    const txBuffer = Buffer.from('register_tx_data_' + Date.now());
    const regResponse = {
      success: true,
      registrationId: 'reg_123',
      transaction: txBuffer.toString('base64'),
      metadata: {
        walletAddress: '9B5X4bq1q1pYzEV3SRsLKNh5D2aJDgGMfVqG6v4bJRsV',
        fullName: 'Test User',
        profession: 'Nurse',
        mint: 'DGLzb1HUJ6Qg1G1yi4FgW1ZeGpNMVXQmkvRR98cKFhJk',
        message: 'Sign this transaction with your wallet to complete registration'
      }
    };
    
    expect(regResponse.registrationId).toBeDefined();
    expect(regResponse.transaction).toBeDefined();
    
    // Verify transaction is valid base64
    expect(regResponse.transaction).toMatch(/^[A-Za-z0-9+/=]*$/);
    
    // CRITICAL TEST: Frontend can decode it
    const decoded = new Uint8Array(fromBase64(regResponse.transaction));
    expect(decoded.length).toBeGreaterThan(0);
    expect(Array.from(decoded)).toEqual(Array.from(txBuffer));
  });
});
