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

// Initialize on load
initializeDatabase();

module.exports = { db, petDb };
