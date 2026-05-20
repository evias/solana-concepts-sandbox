const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

describe('PetVax API - Vaccination Records', () => {
  function createTestDatabase() {
    const testDbPath = `/tmp/test_petvax_${Date.now()}.db`;
    const database = new Database(testDbPath);
    database.pragma('foreign_keys = ON');
    
    // Create pets table
    database.exec(`
      CREATE TABLE IF NOT EXISTS pets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        species TEXT NOT NULL,
        breed TEXT,
        age INTEGER,
        owner TEXT NOT NULL,
        mandate_authority TEXT NOT NULL,
        mint_address TEXT,
        token_account TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    
    // Create vaccinations table
    database.exec(`
      CREATE TABLE IF NOT EXISTS vaccinations (
        id TEXT PRIMARY KEY,
        pet_id TEXT NOT NULL,
        vaccine_name TEXT NOT NULL,
        vaccination_date TEXT NOT NULL,
        vet_address TEXT NOT NULL,
        vet_mandate_authority TEXT,
        notes TEXT,
        mint_address TEXT,
        transaction_signature TEXT,
        transaction_hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_pet_id ON vaccinations(pet_id);
      CREATE INDEX IF NOT EXISTS idx_vet ON vaccinations(vet_address);
      CREATE INDEX IF NOT EXISTS idx_vax_mint ON vaccinations(mint_address);
      CREATE INDEX IF NOT EXISTS idx_tx_sig ON vaccinations(transaction_signature);
      CREATE INDEX IF NOT EXISTS idx_tx_hash ON vaccinations(transaction_hash);
    `);
    
    return { database, testDbPath };
  }
  
  function createPetDbHelper(database) {
    return {
      createPet(petData) {
        const { id, name, species, breed, age, owner, mandateAuthority, mintAddress, tokenAccount } = petData;
        const now = new Date().toISOString();
        
        const stmt = database.prepare(`
          INSERT INTO pets (id, name, species, breed, age, owner, mandate_authority, mint_address, token_account, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(id, name, species, breed, age, owner, mandateAuthority || owner, mintAddress, tokenAccount, now, now);
        return database.prepare('SELECT * FROM pets WHERE id = ?').get(id);
      },
      
      getPetById(id) {
        return database.prepare('SELECT * FROM pets WHERE id = ?').get(id);
      }
    };
  }
  
  function createVaccinationDbHelper(database) {
    return {
      createVaccination(vaccinationData) {
        const { id, petId, vaccineName, vaccinationDate, vetAddress, vetMandateAuthority, notes, mintAddress, transactionSignature, transactionHash } = vaccinationData;
        const now = new Date().toISOString();
        
        // Verify pet exists
        const pet = database.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
        if (!pet) {
          throw new Error(`Pet not found: ${petId}`);
        }
        
        const stmt = database.prepare(`
          INSERT INTO vaccinations (id, pet_id, vaccine_name, vaccination_date, vet_address, vet_mandate_authority, notes, mint_address, transaction_signature, transaction_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(id, petId, vaccineName, vaccinationDate, vetAddress, vetMandateAuthority || vetAddress, notes, mintAddress, transactionSignature || null, transactionHash || null, now, now);
        return database.prepare('SELECT * FROM vaccinations WHERE id = ?').get(id);
      },
      
      getVaccinationById(id) {
        return database.prepare('SELECT * FROM vaccinations WHERE id = ?').get(id);
      },
      
      getVaccinationsByPetId(petId) {
        return database.prepare('SELECT * FROM vaccinations WHERE pet_id = ? ORDER BY vaccination_date DESC').all(petId);
      },
      
      getVaccinationsByVet(vetAddress) {
        return database.prepare('SELECT * FROM vaccinations WHERE vet_address = ? ORDER BY vaccination_date DESC').all(vetAddress);
      },
      
      verifyVaccinationPet(vaccinationId, expectedPetId) {
        const vaccination = this.getVaccinationById(vaccinationId);
        if (!vaccination) {
          return { valid: false, reason: 'Vaccination not found' };
        }
        
        if (vaccination.pet_id !== expectedPetId) {
          return { valid: false, reason: 'Vaccination not linked to this pet' };
        }
        
        return { valid: true, reason: 'Vaccination verified', vaccination };
      },
      
      getVaccinationByTransactionHash(hash) {
        return database.prepare('SELECT * FROM vaccinations WHERE transaction_hash = ?').get(hash);
      }
    };
  }

  describe('Vaccination Database Operations', () => {
    test('should create vaccination linked to a specific pet', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      // Create a pet first
      const pet = petDb.createPet({
        id: 'pet-vax-1',
        name: 'Fluffy',
        species: 'Cat',
        breed: 'Persian',
        age: 3,
        owner: 'owner-addr-1',
        mandateAuthority: 'owner-addr-1',
        mintAddress: 'mint-1',
        tokenAccount: 'token-1'
      });
      
      // Create vaccination for the pet
      const vaccination = vaccinationDb.createVaccination({
        id: 'vax-1',
        petId: pet.id,
        vaccineName: 'Rabies',
        vaccinationDate: '2026-05-19',
        vetAddress: 'vet-addr-1',
        vetMandateAuthority: 'vet-addr-1',
        notes: 'Initial vaccination'
      });
      
      expect(vaccination).toBeDefined();
      expect(vaccination.pet_id).toBe('pet-vax-1');
      expect(vaccination.vaccine_name).toBe('Rabies');
      expect(vaccination.vet_address).toBe('vet-addr-1');
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should reject vaccination linked to non-existent pet', () => {
      const { database, testDbPath } = createTestDatabase();
      const vaccinationDb = createVaccinationDbHelper(database);
      
      expect(() => {
        vaccinationDb.createVaccination({
          id: 'vax-invalid',
          petId: 'nonexistent-pet',
          vaccineName: 'Rabies',
          vaccinationDate: '2026-05-19',
          vetAddress: 'vet-addr'
        });
      }).toThrow('Pet not found');
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should retrieve all vaccinations for a specific pet', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      // Create a pet
      const pet = petDb.createPet({
        id: 'pet-vax-multi',
        name: 'Rex',
        species: 'Dog',
        breed: 'Labrador',
        age: 5,
        owner: 'owner-addr-2',
        mandateAuthority: 'owner-addr-2',
        mintAddress: 'mint-2',
        tokenAccount: 'token-2'
      });
      
      // Create multiple vaccinations
      vaccinationDb.createVaccination({
        id: 'vax-1',
        petId: pet.id,
        vaccineName: 'Rabies',
        vaccinationDate: '2026-05-19',
        vetAddress: 'vet-addr-1'
      });
      
      vaccinationDb.createVaccination({
        id: 'vax-2',
        petId: pet.id,
        vaccineName: 'DPPE',
        vaccinationDate: '2026-04-15',
        vetAddress: 'vet-addr-1'
      });
      
      // Retrieve all vaccinations for pet
      const vaccinations = vaccinationDb.getVaccinationsByPetId(pet.id);
      
      expect(vaccinations).toHaveLength(2);
      expect(vaccinations[0].vaccine_name).toBe('Rabies');
      expect(vaccinations[1].vaccine_name).toBe('DPPE');
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should retrieve vaccinations by vet address', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      // Create two pets
      const pet1 = petDb.createPet({
        id: 'pet-vet-1',
        name: 'Fluffy',
        species: 'Cat',
        breed: 'Persian',
        age: 3,
        owner: 'owner-1',
        mandateAuthority: 'owner-1',
        mintAddress: 'mint-1',
        tokenAccount: 'token-1'
      });
      
      const pet2 = petDb.createPet({
        id: 'pet-vet-2',
        name: 'Whiskers',
        species: 'Cat',
        breed: 'Siamese',
        age: 4,
        owner: 'owner-2',
        mandateAuthority: 'owner-2',
        mintAddress: 'mint-3',
        tokenAccount: 'token-3'
      });
      
      const vetAddr = 'vet-clinic-addr-1';
      
      // Create vaccinations by same vet
      vaccinationDb.createVaccination({
        id: 'vax-vet-1',
        petId: pet1.id,
        vaccineName: 'Rabies',
        vaccinationDate: '2026-05-19',
        vetAddress: vetAddr
      });
      
      vaccinationDb.createVaccination({
        id: 'vax-vet-2',
        petId: pet2.id,
        vaccineName: 'DPPE',
        vaccinationDate: '2026-05-18',
        vetAddress: vetAddr
      });
      
      // Retrieve by vet
      const vetVaccinations = vaccinationDb.getVaccinationsByVet(vetAddr);
      
      expect(vetVaccinations).toHaveLength(2);
      expect(vetVaccinations[0].vet_address).toBe(vetAddr);
      expect(vetVaccinations[1].vet_address).toBe(vetAddr);
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should verify vaccination is linked to correct pet', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      // Create pet
      const pet = petDb.createPet({
        id: 'pet-verify',
        name: 'Buddy',
        species: 'Dog',
        breed: 'Golden Retriever',
        age: 2,
        owner: 'owner-3',
        mandateAuthority: 'owner-3',
        mintAddress: 'mint-4',
        tokenAccount: 'token-4'
      });
      
      // Create vaccination
      const vaccination = vaccinationDb.createVaccination({
        id: 'vax-verify',
        petId: pet.id,
        vaccineName: 'Lepto',
        vaccinationDate: '2026-05-19',
        vetAddress: 'vet-addr'
      });
      
      // Verify correct pet
      const result = vaccinationDb.verifyVaccinationPet('vax-verify', 'pet-verify');
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('Vaccination verified');
      
      // Verify wrong pet
      const wrongResult = vaccinationDb.verifyVaccinationPet('vax-verify', 'different-pet');
      expect(wrongResult.valid).toBe(false);
      expect(wrongResult.reason).toBe('Vaccination not linked to this pet');
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should enforce foreign key constraint for vaccinations', () => {
      const { database, testDbPath } = createTestDatabase();
      
      // Create vaccination table but no pet
      expect(() => {
        database.prepare(`
          INSERT INTO vaccinations (id, pet_id, vaccine_name, vaccination_date, vet_address, vet_mandate_authority, notes, mint_address, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('vax-fk-test', 'nonexistent-pet', 'Rabies', '2026-05-19', 'vet', 'vet', '', '', new Date().toISOString(), new Date().toISOString());
      }).toThrow();
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should set vet_mandate_authority to vet_address if not provided', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      const pet = petDb.createPet({
        id: 'pet-mandate-default',
        name: 'Spike',
        species: 'Dog',
        breed: 'Bulldog',
        age: 4,
        owner: 'owner-4',
        mandateAuthority: 'owner-4',
        mintAddress: 'mint-5',
        tokenAccount: 'token-5'
      });
      
      // Create vaccination without explicit vet_mandate_authority
      const vaccination = vaccinationDb.createVaccination({
        id: 'vax-mandate-default',
        petId: pet.id,
        vaccineName: 'Parvovirus',
        vaccinationDate: '2026-05-19',
        vetAddress: 'vet-addr-5'
        // vetMandateAuthority not provided
      });
      
      // Should default to vet_address
      expect(vaccination.vet_mandate_authority).toBe('vet-addr-5');
      expect(vaccination.vet_mandate_authority).toBe(vaccination.vet_address);
      
      database.close();
      fs.unlinkSync(testDbPath);
    });
  });

  describe('Vaccination Schema', () => {
    test('vaccinations table should have required columns', () => {
      const { database, testDbPath } = createTestDatabase();
      
      const tableInfo = database.prepare("PRAGMA table_info(vaccinations)").all();
      const columnNames = tableInfo.map(col => col.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('pet_id');
      expect(columnNames).toContain('vaccine_name');
      expect(columnNames).toContain('vaccination_date');
      expect(columnNames).toContain('vet_address');
      expect(columnNames).toContain('vet_mandate_authority');
      expect(columnNames).toContain('notes');
      expect(columnNames).toContain('mint_address');
      expect(columnNames).toContain('transaction_signature');
      expect(columnNames).toContain('transaction_hash');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should have proper indexes on vaccinations table', () => {
      const { database, testDbPath } = createTestDatabase();
      
      const indexes = database.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='vaccinations'").all();
      const indexNames = indexes.map(idx => idx.name);
      
      expect(indexNames).toContain('idx_pet_id');
      expect(indexNames).toContain('idx_vet');
      expect(indexNames).toContain('idx_vax_mint');
      expect(indexNames).toContain('idx_tx_sig');
      expect(indexNames).toContain('idx_tx_hash');
      
      database.close();
      fs.unlinkSync(testDbPath);
    });
  });

  describe('Transaction Signature Support', () => {
    test('should store transaction signature with vaccination record', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      const pet = petDb.createPet({
        id: 'pet-sig-1',
        name: 'Buddy',
        species: 'Dog',
        breed: 'Golden Retriever',
        age: 3,
        owner: 'owner-1',
        mandateAuthority: 'owner-1',
        mintAddress: 'mint-1',
        tokenAccount: 'token-1'
      });
      
      const testSignature = 'sig1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const vaccination = vaccinationDb.createVaccination({
        id: 'vax-sig-1',
        petId: pet.id,
        vaccineName: 'Rabies',
        vaccinationDate: '2026-05-20',
        vetAddress: 'vet-addr-1',
        vetMandateAuthority: 'vet-addr-1',
        notes: 'Annual',
        transactionSignature: testSignature
      });
      
      expect(vaccination.transaction_signature).toBe(testSignature);
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should allow vaccination without transaction signature', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      const pet = petDb.createPet({
        id: 'pet-no-sig',
        name: 'Fluffy',
        species: 'Cat',
        breed: 'Persian',
        age: 4,
        owner: 'owner-2',
        mandateAuthority: 'owner-2',
        mintAddress: 'mint-2',
        tokenAccount: 'token-2'
      });
      
      const vaccination = vaccinationDb.createVaccination({
        id: 'vax-no-sig',
        petId: pet.id,
        vaccineName: 'DPPE',
        vaccinationDate: '2026-05-20',
        vetAddress: 'vet-addr-2',
        notes: 'Initial'
        // transactionSignature not provided
      });
      
      expect(vaccination.transaction_signature).toBeNull();
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should retrieve vaccination with transaction signature', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      const pet = petDb.createPet({
        id: 'pet-retrieve-sig',
        name: 'Rex',
        species: 'Dog',
        breed: 'Labrador',
        age: 2,
        owner: 'owner-3',
        mandateAuthority: 'owner-3',
        mintAddress: 'mint-3',
        tokenAccount: 'token-3'
      });
      
      const testSig = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      vaccinationDb.createVaccination({
        id: 'vax-retrieve',
        petId: pet.id,
        vaccineName: 'Lepto',
        vaccinationDate: '2026-05-20',
        vetAddress: 'vet-addr-3',
        transactionSignature: testSig
      });
      
      const retrieved = vaccinationDb.getVaccinationById('vax-retrieve');
      
      expect(retrieved.transaction_signature).toBe(testSig);
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should store and retrieve transaction hash for Solscan lookup', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      const pet = petDb.createPet({
        id: 'pet-hash-1',
        name: 'Shadow',
        species: 'Cat',
        breed: 'Black',
        age: 1,
        owner: 'owner-4',
        mandateAuthority: 'owner-4',
        mintAddress: 'mint-4',
        tokenAccount: 'token-4'
      });
      
      const testHash = '5sGjZRX9yHeYqvdC8LYBz4Y5j8V3sK2mN1pQ6rT7uW8xA9bC0dE1fG2hI3jK4lM5nO6pP7qR8sT9uV0wX1yZ2';
      
      vaccinationDb.createVaccination({
        id: 'vax-hash-1',
        petId: pet.id,
        vaccineName: 'Feline Distemper',
        vaccinationDate: '2026-05-20',
        vetAddress: 'vet-addr-4',
        transactionHash: testHash
      });
      
      // Should be able to look up by hash
      const retrieved = vaccinationDb.getVaccinationByTransactionHash(testHash);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe('vax-hash-1');
      expect(retrieved.transaction_hash).toBe(testHash);
      expect(retrieved.pet_id).toBe(pet.id);
      
      database.close();
      fs.unlinkSync(testDbPath);
    });

    test('should store both signature and hash together', () => {
      const { database, testDbPath } = createTestDatabase();
      const petDb = createPetDbHelper(database);
      const vaccinationDb = createVaccinationDbHelper(database);
      
      const pet = petDb.createPet({
        id: 'pet-both-1',
        name: 'Tiger',
        species: 'Tiger',
        breed: 'Bengal',
        age: 5,
        owner: 'owner-5',
        mandateAuthority: 'owner-5',
        mintAddress: 'mint-5',
        tokenAccount: 'token-5'
      });
      
      const testSig = 'sig123456789';
      const testHash = 'hash123456789';
      
      const vaccination = vaccinationDb.createVaccination({
        id: 'vax-both-1',
        petId: pet.id,
        vaccineName: 'Tiger Shot',
        vaccinationDate: '2026-05-20',
        vetAddress: 'vet-addr-5',
        transactionSignature: testSig,
        transactionHash: testHash
      });
      
      expect(vaccination.transaction_signature).toBe(testSig);
      expect(vaccination.transaction_hash).toBe(testHash);
      
      // Should be retrievable by hash
      const byHash = vaccinationDb.getVaccinationByTransactionHash(testHash);
      expect(byHash.transaction_signature).toBe(testSig);
      
      database.close();
      fs.unlinkSync(testDbPath);
    });
  });
});
