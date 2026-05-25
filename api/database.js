const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create/connect to database
const dbPath = path.join(__dirname, '..', 'pettracker.db');

// Check if database exists; if not, throw error
if (!fs.existsSync(dbPath)) {
  throw new Error(
    `Database not found at ${dbPath}\n` +
    `Please run: npm run db:init\n` +
    `Then run: npm run db:seed\n` +
    `Then run: npm run db:migrate`
  );
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema (only called by db:init script)
function initializeDatabase() {
  // Create pets table
  db.exec(`
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
      authorizedVets TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_owner ON pets(owner);
    CREATE INDEX IF NOT EXISTS idx_mandate ON pets(mandate_authority);
    CREATE INDEX IF NOT EXISTS idx_mint ON pets(mint_address);
  `);
  
  // Create vaccinations table
  db.exec(`
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
  
  console.log('Database schema created at:', dbPath);
}

// Database migrations
function runMigrations() {
  try {
    // Migration 1: Add mandate_authority to pets
    const petTableInfo = db.prepare("PRAGMA table_info(pets)").all();
    const hasMandate = petTableInfo.some(col => col.name === 'mandate_authority');
    
    if (!hasMandate) {
      console.log('Running migration: Adding mandate_authority column to pets...');
      
      db.exec(`ALTER TABLE pets ADD COLUMN mandate_authority TEXT;`);
      db.prepare(`UPDATE pets SET mandate_authority = owner WHERE mandate_authority IS NULL`).run();
      
      console.log('Migration completed: mandate_authority column added');
    }
    
    // Migration 2: Add transaction_signature to vaccinations
    try {
      const vaxTableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
      const hasTxSig = vaxTableInfo.some(col => col.name === 'transaction_signature');
      
      if (!hasTxSig) {
        console.log('Running migration: Adding transaction_signature column to vaccinations...');
        
        db.exec(`ALTER TABLE vaccinations ADD COLUMN transaction_signature TEXT;`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_sig ON vaccinations(transaction_signature);`);
        
        console.log('Migration completed: transaction_signature column added');
      }
      
      // Migration 2b: Add transaction_hash to vaccinations
      const hasTxHash = vaxTableInfo.some(col => col.name === 'transaction_hash');
      
      if (!hasTxHash) {
        console.log('Running migration: Adding transaction_hash column to vaccinations...');
        
        db.exec(`ALTER TABLE vaccinations ADD COLUMN transaction_hash TEXT;`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_hash ON vaccinations(transaction_hash);`);
        
        console.log('Migration completed: transaction_hash column added');
      }
    } catch (error) {
      if (error.message.includes('no such table')) {
        // vaccinations table doesn't exist yet, will be created on init
      } else {
        throw error;
      }
    }
    
    // Migration 3: Add authorizedVets to pets
    const petTableInfo2 = db.prepare("PRAGMA table_info(pets)").all();
    const hasAuthorizedVets = petTableInfo2.some(col => col.name === 'authorizedVets');
    
    if (!hasAuthorizedVets) {
      console.log('Running migration: Adding authorizedVets column to pets...');
      
      db.exec(`ALTER TABLE pets ADD COLUMN authorizedVets TEXT;`);
      db.prepare(`UPDATE pets SET authorizedVets = '[]' WHERE authorizedVets IS NULL`).run();
      
      console.log('Migration completed: authorizedVets column added');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
    // If migration fails, log but don't crash
    if (error.message.includes('duplicate column')) {
      console.log('Column already exists, skipping migration');
    }
  }
}

// Database operations
const petDb = {
  // Create/Register a new pet
  createPet(petData) {
    const { id, name, species, breed, age, owner, mandateAuthority, mintAddress, tokenAccount } = petData;
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO pets (id, name, species, breed, age, owner, mandate_authority, mint_address, token_account, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, name, species, breed, age, owner, mandateAuthority || owner, mintAddress, tokenAccount, now, now);
    
    return petDb.getPetById(id);
  },
  
  // Get pet by ID
  getPetById(id) {
    const stmt = db.prepare('SELECT * FROM pets WHERE id = ?');
    return stmt.get(id);
  },
  
  // Get all pets
  getAllPets() {
    const stmt = db.prepare('SELECT * FROM pets ORDER BY created_at DESC');
    return stmt.all();
  },
  
  // Get pets by owner
  getPetsByOwner(owner) {
    const stmt = db.prepare('SELECT * FROM pets WHERE owner = ? ORDER BY created_at DESC');
    return stmt.all(owner);
  },
  
  // Update pet
  updatePet(id, updates) {
    const now = new Date().toISOString();
    const allowedFields = ['name', 'species', 'breed', 'age', 'mint_address', 'token_account', 'authorizedVets'];
    
    const setClause = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map(key => `${key} = ?`)
      .join(', ');
    
    if (!setClause) {
      return petDb.getPetById(id);
    }
    
    const values = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map(key => updates[key]);
    
    const stmt = db.prepare(`
      UPDATE pets 
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `);
    
    stmt.run(...values, now, id);
    
    return petDb.getPetById(id);
  },
  
  // Delete pet
  deletePet(id) {
    const stmt = db.prepare('DELETE FROM pets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
  
  // Check if pet exists
  petExists(id) {
    const stmt = db.prepare('SELECT 1 FROM pets WHERE id = ? LIMIT 1');
    return stmt.get(id) !== undefined;
  },
  
  // Get pet by mint address
  getPetByMint(mintAddress) {
    const stmt = db.prepare('SELECT * FROM pets WHERE mint_address = ?');
    return stmt.get(mintAddress);
  },
  
  // Verify mandate authority for a pet
  verifyMandate(petId, authority) {
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return { valid: false, reason: 'Pet not found' };
    }
    
    if (pet.mandate_authority !== authority && pet.owner !== authority) {
      return { valid: false, reason: 'Not authorized to manage this pet', pet };
    }
    
    return { valid: true, reason: 'Authorized', pet };
  },
  
  // Get mandate info for a pet
  getMandateInfo(petId) {
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return null;
    }
    
    return {
      petId: pet.id,
      petName: pet.name,
      owner: pet.owner,
      mandateAuthority: pet.mandate_authority,
      createdAt: pet.created_at
    };
  },
  
  // Get authorized vets for a pet
  getAuthorizedVets(petId) {
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return [];
    }
    try {
      return JSON.parse(pet.authorizedVets || '[]');
    } catch (error) {
      console.error(`Failed to parse authorizedVets for pet ${petId}:`, error);
      return [];
    }
  }
};

// Vaccination database operations
const vaccinationDb = {
  // Create/Record a new vaccination
  createVaccination(vaccinationData) {
    const { id, petId, vaccineName, vaccinationDate, vetAddress, vetMandateAuthority, notes, mintAddress, transactionSignature, transactionHash } = vaccinationData;
    const now = new Date().toISOString();
    
    // Verify pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      throw new Error(`Pet not found: ${petId}`);
    }
    
    const stmt = db.prepare(`
      INSERT INTO vaccinations (id, pet_id, vaccine_name, vaccination_date, vet_address, vet_mandate_authority, notes, mint_address, transaction_signature, transaction_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, petId, vaccineName, vaccinationDate, vetAddress, vetMandateAuthority || vetAddress, notes, mintAddress, transactionSignature || null, transactionHash || null, now, now);
    
    return vaccinationDb.getVaccinationById(id);
  },
  
  // Get vaccination by ID
  getVaccinationById(id) {
    const stmt = db.prepare('SELECT * FROM vaccinations WHERE id = ?');
    return stmt.get(id);
  },
  
  // Get all vaccinations for a pet
  getVaccinationsByPetId(petId) {
    const stmt = db.prepare('SELECT * FROM vaccinations WHERE pet_id = ? ORDER BY vaccination_date DESC');
    return stmt.all(petId);
  },
  
  // Get all vaccinations by vet
  getVaccinationsByVet(vetAddress) {
    const stmt = db.prepare('SELECT * FROM vaccinations WHERE vet_address = ? ORDER BY vaccination_date DESC');
    return stmt.all(vetAddress);
  },
  
  // Verify vaccination is linked to a valid pet
  verifyVaccinationPet(vaccinationId, expectedPetId) {
    const vaccination = vaccinationDb.getVaccinationById(vaccinationId);
    if (!vaccination) {
      return { valid: false, reason: 'Vaccination not found' };
    }
    
    if (vaccination.pet_id !== expectedPetId) {
      return { valid: false, reason: 'Vaccination not linked to this pet' };
    }
    
    const pet = petDb.getPetById(vaccination.pet_id);
    if (!pet) {
      return { valid: false, reason: 'Pet not found' };
    }
    
    return { valid: true, reason: 'Vaccination verified', vaccination, pet };
  },
  
  // Check if vet has authorization
  verifyVetAuthorization(vetAddress, expectedAuthority) {
    if (vetAddress !== expectedAuthority) {
      return { valid: false, reason: 'Vet not authorized' };
    }
    return { valid: true, reason: 'Vet authorized' };
  },
  
  // Get vaccination by transaction hash (for Solscan lookup)
  getVaccinationByTransactionHash(transactionHash) {
    const stmt = db.prepare('SELECT * FROM vaccinations WHERE transaction_hash = ?');
    return stmt.get(transactionHash);
  }
};

// Export database and helper functions (do NOT initialize on require)
module.exports = { db, petDb, vaccinationDb, initializeDatabase, runMigrations };
