const Database = require('better-sqlite3');
const path = require('path');

// Create/connect to database
const dbPath = path.join(__dirname, '..', 'pettracker.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_pet_id ON vaccinations(pet_id);
    CREATE INDEX IF NOT EXISTS idx_vet ON vaccinations(vet_address);
    CREATE INDEX IF NOT EXISTS idx_vax_mint ON vaccinations(mint_address);
  `);
  
  // Run migrations
  runMigrations();
  
  console.log('Database initialized at:', dbPath);
}

// Database migrations
function runMigrations() {
  try {
    // Check if mandate_authority column exists
    const tableInfo = db.prepare("PRAGMA table_info(pets)").all();
    const hasMandate = tableInfo.some(col => col.name === 'mandate_authority');
    
    if (!hasMandate) {
      console.log('Running migration: Adding mandate_authority column...');
      
      // Add mandate_authority column with default value
      db.exec(`
        ALTER TABLE pets ADD COLUMN mandate_authority TEXT;
      `);
      
      // Set mandate_authority to owner for all existing pets
      db.prepare(`
        UPDATE pets SET mandate_authority = owner WHERE mandate_authority IS NULL
      `).run();
      
      // Make the column NOT NULL for future inserts
      // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
      db.exec(`
        UPDATE pets SET mandate_authority = owner WHERE mandate_authority IS NULL;
      `);
      
      console.log('Migration completed: mandate_authority column added and populated');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
    // If migration fails, log but don't crash
    if (error.message.includes('duplicate column')) {
      console.log('Column mandate_authority already exists, skipping migration');
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
    const allowedFields = ['name', 'species', 'breed', 'age', 'mint_address', 'token_account'];
    
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
  }
};

// Vaccination database operations
const vaccinationDb = {
  // Create/Record a new vaccination
  createVaccination(vaccinationData) {
    const { id, petId, vaccineName, vaccinationDate, vetAddress, vetMandateAuthority, notes, mintAddress } = vaccinationData;
    const now = new Date().toISOString();
    
    // Verify pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      throw new Error(`Pet not found: ${petId}`);
    }
    
    const stmt = db.prepare(`
      INSERT INTO vaccinations (id, pet_id, vaccine_name, vaccination_date, vet_address, vet_mandate_authority, notes, mint_address, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, petId, vaccineName, vaccinationDate, vetAddress, vetMandateAuthority || vetAddress, notes, mintAddress, now, now);
    
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
  }
};

// Initialize on load
initializeDatabase();

module.exports = { db, petDb, vaccinationDb };
