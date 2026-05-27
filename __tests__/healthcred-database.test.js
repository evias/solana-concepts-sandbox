/**
 * HealthCred Database Tests
 * Tests for credentials, badges, and certifications database operations
 */

const { db, credentialDb, badgeDb, certificationDb } = require('../api/database');

describe('HealthCred Database Operations', () => {
  const testOwnerPrefix = 'jest_test_healthcred_' + Date.now();
  let createdCredentialIds = [];
  let createdBadgeIds = [];
  let createdCertificationIds = [];

  afterAll(() => {
    // Delete all test data created during this test run
    for (const badgeId of createdBadgeIds) {
      try {
        db.prepare('DELETE FROM badges WHERE id = ?').run(badgeId);
      } catch (err) {
        // Silently ignore cleanup errors
      }
    }
    
    for (const certId of createdCertificationIds) {
      try {
        db.prepare('DELETE FROM certifications WHERE id = ?').run(certId);
      } catch (err) {
        // Silently ignore cleanup errors
      }
    }
    
    for (const credentialId of createdCredentialIds) {
      try {
        db.prepare('DELETE FROM credentials WHERE id = ?').run(credentialId);
      } catch (err) {
        // Silently ignore cleanup errors
      }
    }
  });

  // Helper function to create a test credential
  const createTestCredential = (overrides = {}) => {
    const credentialId = `cred_${testOwnerPrefix}_${Math.random()}`;
    createdCredentialIds.push(credentialId);
    
    const didDoc = {
      id: `did:test:${testOwnerPrefix}_${Math.random()}`,
      authentication: ['did:test:key-1', 'did:test:key-2']
    };
    
    const credential = credentialDb.createCredential({
      id: credentialId,
      walletAddress: `wallet_${testOwnerPrefix}_${Math.random()}`,
      fullName: 'Test Healthcare Worker',
      dateOfBirth: '1990-01-15',
      email: 'test@example.com',
      profession: 'Nurse',
      didDocumentJson: JSON.stringify(didDoc),
      didDocumentHash: '0xabc123def456',
      didId: didDoc.id,
      authenticationMethods: JSON.stringify(didDoc.authentication),
      sasCredentialId: 'sas_' + Date.now(),
      mintAddress: 'mint_' + Date.now(),
      transactionSignature: 'sig_' + Date.now(),
      transactionHash: 'hash_' + Date.now(),
      ...overrides
    });
    
    return credential;
  };

  describe('Credential CRUD Operations', () => {
    test('should create a new credential', () => {
      const credential = createTestCredential();
      
      expect(credential).toBeDefined();
      expect(credential.id).toMatch(/^cred_/);
      expect(credential.full_name).toBe('Test Healthcare Worker');
      expect(credential.profession).toBe('Nurse');
      expect(credential.did_document_json.id).toBeDefined();
      expect(credential.did_document_json.authentication).toEqual(['did:test:key-1', 'did:test:key-2']);
    });
    
    test('should retrieve credential by ID', () => {
      const created = createTestCredential();
      const retrieved = credentialDb.getCredentialById(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.full_name).toBe(created.full_name);
      expect(retrieved.did_document_json).toEqual(created.did_document_json);
    });
    
    test('should retrieve credential by wallet address', () => {
      const walletAddress = `wallet_unique_${Date.now()}`;
      const created = createTestCredential({ walletAddress });
      const retrieved = credentialDb.getCredentialByWallet(walletAddress);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.wallet_address).toBe(walletAddress);
      expect(retrieved.id).toBe(created.id);
    });
    
    test('should retrieve credential by DID ID', () => {
      const didDoc = {
        id: `did:test:unique_${Date.now()}`,
        authentication: ['key-1']
      };
      const created = createTestCredential({
        didDocumentJson: JSON.stringify(didDoc),
        didId: didDoc.id
      });
      const retrieved = credentialDb.getCredentialByDidId(didDoc.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.did_id).toBe(didDoc.id);
      expect(retrieved.id).toBe(created.id);
    });
    
    test('should return null for non-existent credential', () => {
      const retrieved = credentialDb.getCredentialById('non_existent');
      expect(retrieved).toBeUndefined();
    });
    
    test('should get total credential count', () => {
      const countBefore = credentialDb.getCredentialCount();
      createTestCredential();
      const countAfter = credentialDb.getCredentialCount();
      
      expect(countAfter).toBe(countBefore + 1);
    });
    
    test('should get all credentials with pagination', () => {
      createTestCredential();
      createTestCredential();
      
      const page1 = credentialDb.getAllCredentials(10, 0);
      expect(Array.isArray(page1)).toBe(true);
      expect(page1.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Credential Validation', () => {
    test('should enforce unique wallet address', () => {
      const walletAddress = `wallet_unique2_${Date.now()}`;
      createTestCredential({ walletAddress });
      
      expect(() => {
        createTestCredential({ walletAddress });
      }).toThrow();
    });
    
    test('should store DID document JSON correctly', () => {
      const didDoc = {
        id: 'did:test:abc123',
        authentication: ['key-1', 'key-2', 'key-3'],
        context: 'https://www.w3.org/ns/did/v1'
      };
      
      const credential = createTestCredential({
        didDocumentJson: JSON.stringify(didDoc),
        didId: didDoc.id
      });
      
      expect(credential.did_document_json).toEqual(didDoc);
      expect(credential.did_document_json.authentication).toHaveLength(3);
    });
  });

  describe('Badge CRUD Operations', () => {
    let testCredential;
    
    beforeAll(() => {
      testCredential = createTestCredential();
    });
    
    test('should create a new badge', () => {
      const badgeId = `badge_${testOwnerPrefix}_${Math.random()}`;
      createdBadgeIds.push(badgeId);
      
      const badge = badgeDb.createBadge({
        id: badgeId,
        credentialId: testCredential.id,
        issuerWallet: `issuer_${Date.now()}`,
        emoji: '⭐',
        description: 'Excellent patient care',
        mintAddress: `mint_${Date.now()}`,
        transactionSignature: `sig_${Date.now()}`,
        transactionHash: `hash_${Date.now()}`
      });
      
      expect(badge).toBeDefined();
      expect(badge.emoji).toBe('⭐');
      expect(badge.description).toBe('Excellent patient care');
    });
    
    test('should retrieve badge by ID', () => {
      const badgeId = `badge_${testOwnerPrefix}_${Math.random()}`;
      createdBadgeIds.push(badgeId);
      
      const created = badgeDb.createBadge({
        id: badgeId,
        credentialId: testCredential.id,
        issuerWallet: `issuer_${Date.now()}`,
        emoji: '💯',
        description: 'Perfect attendance'
      });
      
      const retrieved = badgeDb.getBadgeById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.emoji).toBe('💯');
    });
    
    test('should get all badges for a credential', () => {
      const badge1Id = `badge_${testOwnerPrefix}_${Math.random()}`;
      const badge2Id = `badge_${testOwnerPrefix}_${Math.random()}`;
      createdBadgeIds.push(badge1Id, badge2Id);
      
      badgeDb.createBadge({
        id: badge1Id,
        credentialId: testCredential.id,
        issuerWallet: `issuer_${Date.now()}`,
        emoji: '🏆',
        description: 'Achievement 1'
      });
      
      badgeDb.createBadge({
        id: badge2Id,
        credentialId: testCredential.id,
        issuerWallet: `issuer_${Date.now()}`,
        emoji: '🎖️',
        description: 'Achievement 2'
      });
      
      const badges = badgeDb.getBadgesByCredentialId(testCredential.id);
      expect(Array.isArray(badges)).toBe(true);
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });
    
    test('should get all badges by issuer', () => {
      const issuerWallet = `issuer_unique_${Date.now()}`;
      const badgeId = `badge_${testOwnerPrefix}_${Math.random()}`;
      createdBadgeIds.push(badgeId);
      
      badgeDb.createBadge({
        id: badgeId,
        credentialId: testCredential.id,
        issuerWallet,
        emoji: '👍',
        description: 'Good work'
      });
      
      const badges = badgeDb.getBadgesByIssuer(issuerWallet);
      expect(Array.isArray(badges)).toBe(true);
    });
  });

  describe('Certification CRUD Operations', () => {
    let testCredential;
    
    beforeAll(() => {
      testCredential = createTestCredential();
    });
    
    test('should create a new certification', () => {
      const certId = `cert_${testOwnerPrefix}_${Math.random()}`;
      createdCertificationIds.push(certId);
      
      const certification = certificationDb.createCertification({
        id: certId,
        credentialId: testCredential.id,
        issuerWallet: `issuer_${Date.now()}`,
        filename: 'nursing-cert.pdf',
        fileHash: '0x' + 'a'.repeat(64),
        fileSize: 1024000,
        fileType: 'application/pdf',
        mintAddress: `mint_${Date.now()}`,
        transactionSignature: `sig_${Date.now()}`,
        transactionHash: `hash_${Date.now()}`
      });
      
      expect(certification).toBeDefined();
      expect(certification.filename).toBe('nursing-cert.pdf');
      expect(certification.file_size).toBe(1024000);
    });
    
    test('should retrieve certification by ID', () => {
      const certId = `cert_${testOwnerPrefix}_${Math.random()}`;
      createdCertificationIds.push(certId);
      
      const created = certificationDb.createCertification({
        id: certId,
        credentialId: testCredential.id,
        issuerWallet: `issuer_${Date.now()}`,
        filename: 'diploma.pdf',
        fileHash: '0x' + 'b'.repeat(64)
      });
      
      const retrieved = certificationDb.getCertificationById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.filename).toBe('diploma.pdf');
    });
    
    test('should get all certifications for a credential', () => {
      const cert1Id = `cert_${testOwnerPrefix}_${Math.random()}`;
      const cert2Id = `cert_${testOwnerPrefix}_${Math.random()}`;
      createdCertificationIds.push(cert1Id, cert2Id);
      
      certificationDb.createCertification({
        id: cert1Id,
        credentialId: testCredential.id,
        issuerWallet: `issuer_${Date.now()}`,
        filename: 'cert1.pdf',
        fileHash: '0x' + 'c'.repeat(64)
      });
      
      certificationDb.createCertification({
        id: cert2Id,
        credentialId: testCredential.id,
        issuerWallet: `issuer_${Date.now()}`,
        filename: 'cert2.jpg',
        fileHash: '0x' + 'd'.repeat(64)
      });
      
      const certifications = certificationDb.getCertificationsByCredentialId(testCredential.id);
      expect(Array.isArray(certifications)).toBe(true);
      expect(certifications.length).toBeGreaterThanOrEqual(2);
    });
    
    test('should get all certifications by issuer', () => {
      const issuerWallet = `issuer_unique_${Date.now()}`;
      const certId = `cert_${testOwnerPrefix}_${Math.random()}`;
      createdCertificationIds.push(certId);
      
      certificationDb.createCertification({
        id: certId,
        credentialId: testCredential.id,
        issuerWallet,
        filename: 'cert.pdf',
        fileHash: '0x' + 'e'.repeat(64)
      });
      
      const certifications = certificationDb.getCertificationsByIssuer(issuerWallet);
      expect(Array.isArray(certifications)).toBe(true);
    });
  });

  describe('Cross-table Operations', () => {
    test('should handle cascade delete when credential is deleted', () => {
      const credential = createTestCredential();
      const badgeId = `badge_cascade_${Date.now()}`;
      const certId = `cert_cascade_${Date.now()}`;
      
      createdBadgeIds.push(badgeId);
      createdCertificationIds.push(certId);
      
      badgeDb.createBadge({
        id: badgeId,
        credentialId: credential.id,
        issuerWallet: `issuer_${Date.now()}`,
        emoji: '⭐',
        description: 'Test'
      });
      
      certificationDb.createCertification({
        id: certId,
        credentialId: credential.id,
        issuerWallet: `issuer_${Date.now()}`,
        filename: 'test.pdf',
        fileHash: '0x' + 'f'.repeat(64)
      });
      
      // Verify relationships exist
      let badges = badgeDb.getBadgesByCredentialId(credential.id);
      expect(badges.length).toBeGreaterThan(0);
      
      let certs = certificationDb.getCertificationsByCredentialId(credential.id);
      expect(certs.length).toBeGreaterThan(0);
      
      // Delete the credential
      db.prepare('DELETE FROM credentials WHERE id = ?').run(credential.id);
      
      // Verify cascade delete removed related records
      badges = badgeDb.getBadgesByCredentialId(credential.id);
      certs = certificationDb.getCertificationsByCredentialId(credential.id);
      
      expect(badges).toHaveLength(0);
      expect(certs).toHaveLength(0);
    });
  });
});
