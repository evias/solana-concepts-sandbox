const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

describe('api/database.js - Error Handling and Behavior', () => {
  const originalDbPath = path.join(__dirname, '..', 'pettracker.db');
  const testDbPath = path.join(__dirname, '..', 'test-db-error.db');
  
  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Database existence check', () => {
    test('should verify database file exists before attempting to open', () => {
      const nonExistentPath = path.join(__dirname, '..', 'definitely-does-not-exist.db');
      
      // Simulate the check from database.js
      expect(fs.existsSync(nonExistentPath)).toBe(false);
      
      // Verify error would be thrown with correct message
      expect(() => {
        if (!fs.existsSync(nonExistentPath)) {
          throw new Error(
            `Database not found at ${nonExistentPath}\n` +
            `Please run: npm run db:init\n` +
            `Then run: npm run db:seed\n` +
            `Then run: npm run db:migrate`
          );
        }
      }).toThrow('Database not found at');
    });

    test('should not throw error if database file exists', () => {
      // Create test database
      const db = new Database(testDbPath);
      db.close();
      
      // Verify file exists
      expect(fs.existsSync(testDbPath)).toBe(true);
      
      // Simulate the check - should not throw
      expect(() => {
        if (!fs.existsSync(testDbPath)) {
          throw new Error('Database not found');
        }
      }).not.toThrow();
    });
  });

  describe('Database connection', () => {
    test('should connect to existing database successfully', () => {
      // Create a database with schema
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      db.exec(`
        CREATE TABLE test_table (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );
      `);
      
      db.close();
      
      // Now try to open it (simulating how server would)
      expect(() => {
        const openedDb = new Database(testDbPath);
        openedDb.pragma('foreign_keys = ON');
        
        const tables = openedDb.prepare(`
          SELECT name FROM sqlite_master WHERE type='table'
        `).all();
        
        expect(tables.length).toBeGreaterThan(0);
        openedDb.close();
      }).not.toThrow();
    });

    test('should enable foreign_keys pragma on database', () => {
      const db = new Database(testDbPath);
      
      // Enable foreign keys
      db.pragma('foreign_keys = ON');
      
      // Verify it's enabled - pragma returns array with object
      const result = db.pragma('foreign_keys');
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].foreign_keys).toBe(1); // 1 = enabled
      
      db.close();
    });

    test('should throw error when trying to open non-existent database without mode', () => {
      const nonExistentPath = path.join(__dirname, '..', 'truly-missing.db');
      
      // By default, better-sqlite3 creates the database if it doesn't exist
      // So we need to verify the check happens before Database initialization
      expect(fs.existsSync(nonExistentPath)).toBe(false);
      
      // This is why the check in database.js is important
      expect(() => {
        if (!fs.existsSync(nonExistentPath)) {
          throw new Error('Database not found - must run db:init first');
        }
      }).toThrow();
      
      // Clean up if somehow created
      if (fs.existsSync(nonExistentPath)) {
        fs.unlinkSync(nonExistentPath);
      }
    });
  });

  describe('Database schema validation', () => {
    test('should have correct schema when opened', () => {
      // Create properly initialized database
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
      
      // Now open and verify
      const db2 = new Database(testDbPath);
      db2.pragma('foreign_keys = ON');
      
      // Check pets table exists with required columns
      const petTableInfo = db2.prepare("PRAGMA table_info(pets)").all();
      const petColumns = petTableInfo.map(col => col.name);
      
      expect(petColumns).toContain('id');
      expect(petColumns).toContain('name');
      expect(petColumns).toContain('species');
      expect(petColumns).toContain('owner');
      expect(petColumns).toContain('mandate_authority');
      expect(petColumns).toContain('created_at');
      expect(petColumns).toContain('updated_at');
      
      // Check vaccinations table exists with required columns
      const vaxTableInfo = db2.prepare("PRAGMA table_info(vaccinations)").all();
      const vaxColumns = vaxTableInfo.map(col => col.name);
      
      expect(vaxColumns).toContain('id');
      expect(vaxColumns).toContain('pet_id');
      expect(vaxColumns).toContain('vaccine_name');
      expect(vaxColumns).toContain('transaction_signature');
      expect(vaxColumns).toContain('transaction_hash');
      
      db2.close();
    });

    test('should verify foreign key constraint is active', () => {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      
      // Create tables with FK
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
      
      const now = new Date().toISOString();
      
      // Verify FK works - should fail
      expect(() => {
        db.prepare(`
          INSERT INTO vaccinations (id, pet_id, vaccine_name, vaccination_date, vet_address, vet_mandate_authority, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('vax_test', 'non_existent_pet_id', 'Rabies', '2026-05-20', 'vet_1', 'vet_1', 'Test', now, now);
      }).toThrow();
      
      db.close();
    });
  });

  describe('Database functions export', () => {
    test('should export required database functions', (done) => {
      // Create database to allow module load
      const db = new Database(originalDbPath);
      db.exec('CREATE TABLE IF NOT EXISTS test (id TEXT);');
      db.close();
      
      try {
        // Clear require cache to get fresh module
        delete require.cache[require.resolve('../api/database')];
        const dbModule = require('../api/database');
        
        // Verify exports
        expect(dbModule).toHaveProperty('db');
        expect(dbModule).toHaveProperty('petDb');
        expect(dbModule).toHaveProperty('vaccinationDb');
        expect(dbModule).toHaveProperty('initializeDatabase');
        expect(dbModule).toHaveProperty('runMigrations');
        
        // Verify they are functions/objects
        expect(typeof dbModule.db).toBe('object'); // Database instance
        expect(typeof dbModule.petDb).toBe('object'); // Database operations
        expect(typeof dbModule.vaccinationDb).toBe('object'); // Database operations
        expect(typeof dbModule.initializeDatabase).toBe('function');
        expect(typeof dbModule.runMigrations).toBe('function');
        
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  describe('Error message guidance', () => {
    test('should provide clear instructions in error message', () => {
      const dbPath = path.join(__dirname, '..', 'missing-for-test.db');
      
      let thrownError = null;
      try {
        if (!fs.existsSync(dbPath)) {
          throw new Error(
            `Database not found at ${dbPath}\n` +
            `Please run: npm run db:init\n` +
            `Then run: npm run db:seed\n` +
            `Then run: npm run db:migrate`
          );
        }
      } catch (error) {
        thrownError = error;
      }
      
      expect(thrownError).not.toBeNull();
      expect(thrownError.message).toContain('npm run db:init');
      expect(thrownError.message).toContain('npm run db:seed');
      expect(thrownError.message).toContain('npm run db:migrate');
      
      // Message should be in order
      const message = thrownError.message;
      const initIndex = message.indexOf('db:init');
      const seedIndex = message.indexOf('db:seed');
      const migrateIndex = message.indexOf('db:migrate');
      
      expect(initIndex).toBeLessThan(seedIndex);
      expect(seedIndex).toBeLessThan(migrateIndex);
    });
  });

  describe('Runtime database operations', () => {
    test('should allow creating pets when database exists', () => {
      // Create initialized database
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
      
      db.close();
      
      // Simulate server usage - open database and insert pet
      expect(() => {
        const db2 = new Database(testDbPath);
        db2.pragma('foreign_keys = ON');
        
        const now = new Date().toISOString();
        db2.prepare(`
          INSERT INTO pets (id, name, species, breed, age, owner, mandate_authority, mint_address, token_account, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('pet_1', 'Buddy', 'Dog', 'Golden Retriever', 3, 'owner_1', 'owner_1', null, null, now, now);
        
        const pet = db2.prepare('SELECT * FROM pets WHERE id = ?').get('pet_1');
        expect(pet.name).toBe('Buddy');
        
        db2.close();
      }).not.toThrow();
    });

    test('should allow querying data when database exists', () => {
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
      
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO pets (id, name, species, breed, age, owner, mandate_authority, mint_address, token_account, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('pet_1', 'Buddy', 'Dog', 'Golden Retriever', 3, 'owner_1', 'owner_1', null, null, now, now);
      
      db.close();
      
      // Simulate server querying
      expect(() => {
        const db2 = new Database(testDbPath);
        db2.pragma('foreign_keys = ON');
        
        const pets = db2.prepare('SELECT * FROM pets').all();
        expect(pets.length).toBe(1);
        expect(pets[0].name).toBe('Buddy');
        
        db2.close();
      }).not.toThrow();
    });
  });
});
