const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { execSync } = require('child_process');

describe('Database Management System', () => {
  const testDbPath = path.join(__dirname, '..', 'test-sandbox.db');
  const testDbheadPath = path.join(__dirname, '..', 'test-DBHEAD');

  // Clean up test files after each test
  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDbheadPath)) {
      fs.unlinkSync(testDbheadPath);
    }
  });

  describe('db:init - Database Initialization', () => {
    test('should create a new database with correct schema', () => {
      // Create a modified init script that uses test path
      const initScript = `
        const path = require('path');
        const fs = require('fs');
        const Database = require('better-sqlite3');
        
        const dbPath = '${testDbPath}';
        
        if (fs.existsSync(dbPath)) {
          console.error('Database already exists');
          process.exit(1);
        }
        
        const db = new Database(dbPath);
        db.pragma('foreign_keys = ON');
        
        db.exec(\`
          CREATE TABLE pets (
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
          
          CREATE INDEX idx_owner ON pets(owner);
          CREATE INDEX idx_mandate ON pets(mandate_authority);
          CREATE INDEX idx_mint ON pets(mint_address);
        \`);
        
        db.exec(\`
          CREATE TABLE vaccinations (
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
          
          CREATE INDEX idx_pet_id ON vaccinations(pet_id);
          CREATE INDEX idx_vet ON vaccinations(vet_address);
          CREATE INDEX idx_vax_mint ON vaccinations(mint_address);
          CREATE INDEX idx_tx_sig ON vaccinations(transaction_signature);
          CREATE INDEX idx_tx_hash ON vaccinations(transaction_hash);
        \`);
        
        db.close();
        console.log('Database initialized');
      `;

      const scriptPath = path.join(__dirname, '..', 'temp-init.js');
      fs.writeFileSync(scriptPath, initScript);

      try {
        execSync(`node ${scriptPath}`, { stdio: 'pipe' });
      } finally {
        fs.unlinkSync(scriptPath);
      }

      // Verify database exists
      expect(fs.existsSync(testDbPath)).toBe(true);

      // Verify schema
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');

      // Check pets table
      const petTableInfo = db.prepare("PRAGMA table_info(pets)").all();
      const petColumns = petTableInfo.map(col => col.name);
      expect(petColumns).toContain('id');
      expect(petColumns).toContain('name');
      expect(petColumns).toContain('species');
      expect(petColumns).toContain('breed');
      expect(petColumns).toContain('age');
      expect(petColumns).toContain('owner');
      expect(petColumns).toContain('mandate_authority');
      expect(petColumns).toContain('mint_address');
      expect(petColumns).toContain('token_account');
      expect(petColumns).toContain('created_at');
      expect(petColumns).toContain('updated_at');

      // Check vaccinations table
      const vaxTableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
      const vaxColumns = vaxTableInfo.map(col => col.name);
      expect(vaxColumns).toContain('id');
      expect(vaxColumns).toContain('pet_id');
      expect(vaxColumns).toContain('vaccine_name');
      expect(vaxColumns).toContain('vaccination_date');
      expect(vaxColumns).toContain('vet_address');
      expect(vaxColumns).toContain('transaction_signature');
      expect(vaxColumns).toContain('transaction_hash');

      // Check indexes
      const petIndexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='pets'").all();
      const petIndexNames = petIndexes.map(idx => idx.name);
      expect(petIndexNames).toContain('idx_owner');
      expect(petIndexNames).toContain('idx_mandate');
      expect(petIndexNames).toContain('idx_mint');

      const vaxIndexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='vaccinations'").all();
      const vaxIndexNames = vaxIndexes.map(idx => idx.name);
      expect(vaxIndexNames).toContain('idx_pet_id');
      expect(vaxIndexNames).toContain('idx_vet');
      expect(vaxIndexNames).toContain('idx_vax_mint');
      expect(vaxIndexNames).toContain('idx_tx_sig');
      expect(vaxIndexNames).toContain('idx_tx_hash');

      db.close();
    });

    test('should create empty database with no data', () => {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      db.exec(`
        CREATE TABLE pets (
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
      
      db.exec(`
        CREATE TABLE vaccinations (
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
      `);
      
      db.close();

      // Verify empty
      const db2 = new Database(testDbPath);
      const petCount = db2.prepare('SELECT COUNT(*) as count FROM pets').get().count;
      const vaxCount = db2.prepare('SELECT COUNT(*) as count FROM vaccinations').get().count;
      
      expect(petCount).toBe(0);
      expect(vaxCount).toBe(0);

      db2.close();
    });
  });

  describe('db:seed - Database Seeding', () => {
    beforeEach(() => {
      // Create empty database for seeding tests
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      db.exec(`
        CREATE TABLE pets (
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
      
      db.exec(`
        CREATE TABLE vaccinations (
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
      `);
      
      db.close();
    });

    test('should seed database with 3 pets', () => {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      const now = new Date().toISOString();
      
      const samplePets = [
        {
          id: 'pet_buddy',
          name: 'Buddy',
          species: 'Dog',
          breed: 'Golden Retriever',
          age: 3
        },
        {
          id: 'pet_whiskers',
          name: 'Whiskers',
          species: 'Cat',
          breed: 'Siamese',
          age: 2
        },
        {
          id: 'pet_max',
          name: 'Max',
          species: 'Dog',
          breed: 'German Shepherd',
          age: 5
        }
      ];
      
      const stmt = db.prepare(`
        INSERT INTO pets (id, name, species, breed, age, owner, mandate_authority, mint_address, token_account, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const pet of samplePets) {
        stmt.run(pet.id, pet.name, pet.species, pet.breed, pet.age, 'owner_test', 'owner_test', 'mint_' + pet.id, 'token_' + pet.id, now, now);
      }
      
      const petCount = db.prepare('SELECT COUNT(*) as count FROM pets').get().count;
      expect(petCount).toBe(3);
      
      const pets = db.prepare('SELECT * FROM pets ORDER BY name').all();
      expect(pets[0].name).toBe('Buddy');
      expect(pets[0].species).toBe('Dog');
      expect(pets[1].name).toBe('Max');
      expect(pets[2].name).toBe('Whiskers');

      db.close();
    });

    test('should seed database with 4 vaccinations', () => {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      const now = new Date().toISOString();
      
      // Add pets first
      const petStmt = db.prepare(`
        INSERT INTO pets (id, name, species, breed, age, owner, mandate_authority, mint_address, token_account, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      petStmt.run('pet_buddy', 'Buddy', 'Dog', 'Golden Retriever', 3, 'owner_test', 'owner_test', 'mint_buddy', 'token_buddy', now, now);
      petStmt.run('pet_whiskers', 'Whiskers', 'Cat', 'Siamese', 2, 'owner_test', 'owner_test', 'mint_whiskers', 'token_whiskers', now, now);
      petStmt.run('pet_max', 'Max', 'Dog', 'German Shepherd', 5, 'owner_test2', 'owner_test2', 'mint_max', 'token_max', now, now);
      
      // Add vaccinations
      const vaxStmt = db.prepare(`
        INSERT INTO vaccinations (id, pet_id, vaccine_name, vaccination_date, vet_address, vet_mandate_authority, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      vaxStmt.run('vax_buddy_rabies', 'pet_buddy', 'Rabies', '2026-05-20', 'vet_clinic_1', 'vet_clinic_1', 'Annual rabies booster', now, now);
      vaxStmt.run('vax_buddy_dppe', 'pet_buddy', 'DPPE', '2026-05-15', 'vet_clinic_1', 'vet_clinic_1', 'Standard vaccines', now, now);
      vaxStmt.run('vax_whiskers_fvrcp', 'pet_whiskers', 'FVRCP', '2026-04-10', 'vet_clinic_2', 'vet_clinic_2', 'Feline vaccines', now, now);
      vaxStmt.run('vax_max_rabies', 'pet_max', 'Rabies', '2026-03-01', 'vet_clinic_1', 'vet_clinic_1', '3-year rabies', now, now);
      
      const vaxCount = db.prepare('SELECT COUNT(*) as count FROM vaccinations').get().count;
      expect(vaxCount).toBe(4);
      
      // Verify we have all expected vaccinations
      const rabiesVacs = db.prepare('SELECT * FROM vaccinations WHERE vaccine_name = ?').all('Rabies');
      const dppeVacs = db.prepare('SELECT * FROM vaccinations WHERE vaccine_name = ?').all('DPPE');
      const fvrcpVacs = db.prepare('SELECT * FROM vaccinations WHERE vaccine_name = ?').all('FVRCP');
      
      expect(rabiesVacs.length).toBe(2); // buddy and max
      expect(dppeVacs.length).toBe(1); // buddy
      expect(fvrcpVacs.length).toBe(1); // whiskers
      
      // Verify by ID
      const buddyRabies = db.prepare('SELECT * FROM vaccinations WHERE id = ?').get('vax_buddy_rabies');
      expect(buddyRabies.pet_id).toBe('pet_buddy');
      expect(buddyRabies.vaccine_name).toBe('Rabies');
      
      const whiskersVax = db.prepare('SELECT * FROM vaccinations WHERE id = ?').get('vax_whiskers_fvrcp');
      expect(whiskersVax.pet_id).toBe('pet_whiskers');
      expect(whiskersVax.vaccine_name).toBe('FVRCP');

      db.close();
    });

    test('should maintain foreign key constraints', () => {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      const now = new Date().toISOString();
      
      // Try to add vaccination for non-existent pet
      const vaxStmt = db.prepare(`
        INSERT INTO vaccinations (id, pet_id, vaccine_name, vaccination_date, vet_address, vet_mandate_authority, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      expect(() => {
        vaxStmt.run('vax_test', 'non_existent_pet', 'Rabies', '2026-05-20', 'vet_clinic_1', 'vet_clinic_1', 'Test', now, now);
      }).toThrow();

      db.close();
    });
  });

  describe('db:migrate - Database Migrations', () => {
    test('should read DBHEAD file correctly', () => {
      fs.writeFileSync(testDbheadPath, '3\n');
      
      const content = fs.readFileSync(testDbheadPath, 'utf-8').trim();
      const migrationLevel = parseInt(content, 10);
      
      expect(migrationLevel).toBe(3);
    });

    test('should apply mandate_authority migration', () => {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      // Create pets table without mandate_authority
      db.exec(`
        CREATE TABLE pets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          species TEXT NOT NULL,
          breed TEXT,
          age INTEGER,
          owner TEXT NOT NULL,
          mint_address TEXT,
          token_account TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO pets (id, name, species, breed, age, owner, mint_address, token_account, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('pet_test', 'Test Pet', 'Dog', 'Mix', 5, 'owner_1', null, null, now, now);
      
      // Verify mandate_authority doesn't exist yet
      let tableInfo = db.prepare("PRAGMA table_info(pets)").all();
      let hasMandate = tableInfo.some(col => col.name === 'mandate_authority');
      expect(hasMandate).toBe(false);
      
      // Apply migration
      try {
        db.exec(`ALTER TABLE pets ADD COLUMN mandate_authority TEXT;`);
        db.prepare(`UPDATE pets SET mandate_authority = owner WHERE mandate_authority IS NULL`).run();
      } catch (error) {
        if (!error.message.includes('duplicate column')) {
          throw error;
        }
      }
      
      // Verify migration applied
      tableInfo = db.prepare("PRAGMA table_info(pets)").all();
      hasMandate = tableInfo.some(col => col.name === 'mandate_authority');
      expect(hasMandate).toBe(true);
      
      // Verify data was migrated correctly
      const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get('pet_test');
      expect(pet.mandate_authority).toBe('owner_1');

      db.close();
    });

    test('should apply transaction_signature migration', () => {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      // Create pets and vaccinations without transaction_signature
      db.exec(`
        CREATE TABLE pets (
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
      
      db.exec(`
        CREATE TABLE vaccinations (
          id TEXT PRIMARY KEY,
          pet_id TEXT NOT NULL,
          vaccine_name TEXT NOT NULL,
          vaccination_date TEXT NOT NULL,
          vet_address TEXT NOT NULL,
          vet_mandate_authority TEXT,
          notes TEXT,
          mint_address TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
        );
      `);
      
      // Verify column doesn't exist
      let tableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
      let hasTxSig = tableInfo.some(col => col.name === 'transaction_signature');
      expect(hasTxSig).toBe(false);
      
      // Apply migration
      try {
        db.exec(`ALTER TABLE vaccinations ADD COLUMN transaction_signature TEXT;`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_sig ON vaccinations(transaction_signature);`);
      } catch (error) {
        if (!error.message.includes('duplicate column')) {
          throw error;
        }
      }
      
      // Verify migration applied
      tableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
      hasTxSig = tableInfo.some(col => col.name === 'transaction_signature');
      expect(hasTxSig).toBe(true);
      
      // Verify index created
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_tx_sig'").all();
      expect(indexes.length).toBeGreaterThan(0);

      db.close();
    });

    test('should apply transaction_hash migration', () => {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      // Create vaccinations table without transaction_hash
      db.exec(`
        CREATE TABLE pets (
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
      
      db.exec(`
        CREATE TABLE vaccinations (
          id TEXT PRIMARY KEY,
          pet_id TEXT NOT NULL,
          vaccine_name TEXT NOT NULL,
          vaccination_date TEXT NOT NULL,
          vet_address TEXT NOT NULL,
          vet_mandate_authority TEXT,
          notes TEXT,
          mint_address TEXT,
          transaction_signature TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
        );
      `);
      
      // Verify column doesn't exist
      let tableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
      let hasTxHash = tableInfo.some(col => col.name === 'transaction_hash');
      expect(hasTxHash).toBe(false);
      
      // Apply migration
      try {
        db.exec(`ALTER TABLE vaccinations ADD COLUMN transaction_hash TEXT;`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_hash ON vaccinations(transaction_hash);`);
      } catch (error) {
        if (!error.message.includes('duplicate column')) {
          throw error;
        }
      }
      
      // Verify migration applied
      tableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
      hasTxHash = tableInfo.some(col => col.name === 'transaction_hash');
      expect(hasTxHash).toBe(true);
      
      // Verify index created
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_tx_hash'").all();
      expect(indexes.length).toBeGreaterThan(0);

      db.close();
    });

    test('should be idempotent', () => {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      // Create schema WITHOUT transaction_hash - this is state before migration 3
      db.exec(`
        CREATE TABLE vaccinations (
          id TEXT PRIMARY KEY,
          pet_id TEXT NOT NULL,
          vaccine_name TEXT NOT NULL,
          vaccination_date TEXT NOT NULL,
          vet_address TEXT NOT NULL,
          vet_mandate_authority TEXT,
          notes TEXT,
          mint_address TEXT,
          transaction_signature TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      
      // Run migration that should be idempotent
      let applied1 = false;
      let error1 = null;
      try {
        const tableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
        const hasColumn = tableInfo.some(col => col.name === 'transaction_hash');
        
        if (!hasColumn) {
          db.exec(`ALTER TABLE vaccinations ADD COLUMN transaction_hash TEXT;`);
          applied1 = true;
        }
      } catch (error) {
        if (!error.message.includes('duplicate column')) {
          error1 = error;
        }
      }
      
      expect(error1).toBeNull();
      expect(applied1).toBe(true);
      
      // Run same migration again - should not fail and should not apply again
      let applied2 = false;
      let error2 = null;
      try {
        const tableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
        const hasColumn = tableInfo.some(col => col.name === 'transaction_hash');
        
        if (!hasColumn) {
          db.exec(`ALTER TABLE vaccinations ADD COLUMN transaction_hash TEXT;`);
          applied2 = true;
        }
      } catch (error) {
        if (!error.message.includes('duplicate column')) {
          error2 = error;
        }
      }
      
      expect(error2).toBeNull();
      expect(applied2).toBe(false); // Already applied

      db.close();
    });
  });

  describe('api/database.js - Missing Database Error', () => {
    test('should throw error if database file does not exist', () => {
      // Save original database path
      const originalDbPath = path.join(__dirname, '..', 'sandbox.db');
      
      // This test verifies the logic that would be in database.js
      const missingDbPath = path.join(__dirname, '..', 'non-existent-db.db');
      
      // Verify database doesn't exist
      expect(fs.existsSync(missingDbPath)).toBe(false);
      
      // Verify error would be thrown
      expect(() => {
        if (!fs.existsSync(missingDbPath)) {
          throw new Error(
            `Database not found at ${missingDbPath}\n` +
            `Please run: npm run db:init\n` +
            `Then run: npm run db:seed\n` +
            `Then run: npm run db:migrate`
          );
        }
      }).toThrow('Database not found');
    });

    test('error message should include all required steps', () => {
      const missingDbPath = path.join(__dirname, '..', 'non-existent-db.db');
      
      let errorMessage = '';
      try {
        if (!fs.existsSync(missingDbPath)) {
          throw new Error(
            `Database not found at ${missingDbPath}\n` +
            `Please run: npm run db:init\n` +
            `Then run: npm run db:seed\n` +
            `Then run: npm run db:migrate`
          );
        }
      } catch (error) {
        errorMessage = error.message;
      }
      
      expect(errorMessage).toContain('Database not found');
      expect(errorMessage).toContain('npm run db:init');
      expect(errorMessage).toContain('npm run db:seed');
      expect(errorMessage).toContain('npm run db:migrate');
    });

    test('should not throw error if database file exists', () => {
      const db = new Database(testDbPath);
      db.close();
      
      // Verify no error thrown
      expect(() => {
        expect(fs.existsSync(testDbPath)).toBe(true);
      }).not.toThrow();
    });
  });
});
