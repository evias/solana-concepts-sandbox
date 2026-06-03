const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./logger');
const log = createLogger('database');

// Use test database in test environment, production database otherwise
const dbFileName = process.env.NODE_ENV === 'test' ? 'sandbox.test.db' : 'sandbox.db';
const dbPath = path.join(__dirname, '..', dbFileName);

// For test database, create it if it doesn't exist (copy from production)
if (process.env.NODE_ENV === 'test') {
  const productionDbPath = path.join(__dirname, '..', 'sandbox.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(productionDbPath)) {
    fs.copyFileSync(productionDbPath, dbPath);
  }
} else {
  // Check if production database exists
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Database not found at ${dbPath}\n` +
      `Please run: npm run db:init\n` +
      `Then run: npm run db:seed\n` +
      `Then run: npm run db:migrate`
    );
  }
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
  
  // Create nutrition_plans table
  db.exec(`
    CREATE TABLE IF NOT EXISTS nutrition_plans (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      ingredients_monday TEXT NOT NULL,
      ingredients_tuesday TEXT NOT NULL,
      ingredients_wednesday TEXT NOT NULL,
      ingredients_thursday TEXT NOT NULL,
      ingredients_friday TEXT NOT NULL,
      ingredients_saturday TEXT NOT NULL,
      ingredients_sunday TEXT NOT NULL,
      duration TEXT NOT NULL,
      duration_end_date TEXT NOT NULL,
      authorized_nutritioner TEXT,
      mint_address TEXT,
      transaction_signature TEXT,
      transaction_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_diet_pet_id ON nutrition_plans(pet_id);
    CREATE INDEX IF NOT EXISTS idx_diet_nutritioner ON nutrition_plans(authorized_nutritioner);
    CREATE INDEX IF NOT EXISTS idx_diet_mint ON nutrition_plans(mint_address);
  `);
  
  // Create feeding_actions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS feeding_actions (
      id TEXT PRIMARY KEY,
      nutrition_plan_id TEXT NOT NULL,
      pet_id TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      pet_signature TEXT NOT NULL,
      transaction_signature TEXT,
      transaction_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (nutrition_plan_id) REFERENCES nutrition_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_feeding_plan_id ON feeding_actions(nutrition_plan_id);
    CREATE INDEX IF NOT EXISTS idx_feeding_pet_id ON feeding_actions(pet_id);
    CREATE INDEX IF NOT EXISTS idx_feeding_tx_sig ON feeding_actions(transaction_signature);
  `);
  
  log.info('Database schema created at:', { value: dbPath });
}

// Database migrations
function runMigrations() {
  try {
    // Note: All database migrations are now managed in scripts/db-migrate.js
    // This function is kept for backward compatibility but is no longer needed
    // Migrations should be run via: npm run db:migrate
    log.info('ℹ️  Migrations are managed by scripts/db-migrate.js');
    log.info('  Run: npm run db:migrate');
  } catch (error) {
    log.error('Migration error:', { error: error.message });
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
       log.error(`Failed to parse authorizedVets for pet ${petId}`, { error });
       return [];
     }
  },
  
  // Check if a vet address is authorized for a pet
  isVetAuthorizedForPet(petId, vetAddress) {
    const pet = petDb.getPetById(petId);
    if (!pet) {
      return false;
    }
    
    // Vet is authorized if they are the owner or in the authorizedVets list
    if (pet.owner === vetAddress) {
      return true;
    }
    
    try {
      const authorizedVets = JSON.parse(pet.authorizedVets || '[]');
      // Handle both string addresses and object format for vets
      return authorizedVets.some(vet => {
        if (typeof vet === 'string') {
          return vet === vetAddress;
        } else if (typeof vet === 'object' && vet.address) {
          return vet.address === vetAddress;
        }
        return false;
      });
     } catch (error) {
       log.error(`Failed to parse authorizedVets for pet ${petId}`, { error });
       return false;
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

// Nutrition plan database operations
const nutritionPlanDb = {
  // Create a new nutrition plan
  createNutritionPlan(planData) {
    const { 
      id, 
      petId, 
      planName, 
      startDate, 
      ingredientsMonday, 
      ingredientsTuesday, 
      ingredientsWednesday, 
      ingredientsThursday, 
      ingredientsFriday, 
      ingredientsSaturday, 
      ingredientsSunday, 
      duration, 
      durationEndDate, 
      authorizedNutritioner, 
      mintAddress, 
      transactionSignature, 
      transactionHash 
    } = planData;
    const now = new Date().toISOString();
    
    // Verify pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      throw new Error(`Pet not found: ${petId}`);
    }
    
    const stmt = db.prepare(`
      INSERT INTO nutrition_plans (
        id, pet_id, plan_name, start_date, ingredients_monday, ingredients_tuesday, 
        ingredients_wednesday, ingredients_thursday, ingredients_friday, ingredients_saturday, 
        ingredients_sunday, duration, duration_end_date, authorized_nutritioner, 
        mint_address, transaction_signature, transaction_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, petId, planName, startDate, ingredientsMonday, ingredientsTuesday, 
      ingredientsWednesday, ingredientsThursday, ingredientsFriday, ingredientsSaturday, 
      ingredientsSunday, duration, durationEndDate, authorizedNutritioner || null, 
      mintAddress, transactionSignature || null, transactionHash || null, now, now
    );
    
    return nutritionPlanDb.getNutritionPlanById(id);
  },
  
  // Get nutrition plan by ID
  getNutritionPlanById(id) {
    const stmt = db.prepare('SELECT * FROM nutrition_plans WHERE id = ?');
    return stmt.get(id);
  },
  
  // Get all nutrition plans for a pet
  getNutritionPlansByPetId(petId) {
    const stmt = db.prepare('SELECT * FROM nutrition_plans WHERE pet_id = ? ORDER BY start_date DESC');
    return stmt.all(petId);
  },
  
  // Get nutrition plans by authorized nutritioner
  getNutritionPlansByNutritioner(nutritionerAddress) {
    const stmt = db.prepare('SELECT * FROM nutrition_plans WHERE authorized_nutritioner = ? ORDER BY start_date DESC');
    return stmt.all(nutritionerAddress);
  },
  
  // Get ingredients for a specific day (day: 0=Monday, 1=Tuesday, ..., 6=Sunday)
  getIngredientsForDay(planId, dayIndex) {
    const plan = nutritionPlanDb.getNutritionPlanById(planId);
    if (!plan) return null;
    
    const dayColumns = [
      'ingredients_monday',
      'ingredients_tuesday',
      'ingredients_wednesday',
      'ingredients_thursday',
      'ingredients_friday',
      'ingredients_saturday',
      'ingredients_sunday'
    ];
    
    return plan[dayColumns[dayIndex]] || null;
  },
  
  // Get all ingredients for a plan (as array)
  getAllIngredients(planId) {
    const plan = nutritionPlanDb.getNutritionPlanById(planId);
    if (!plan) return [];
    
    return [
      plan.ingredients_monday,
      plan.ingredients_tuesday,
      plan.ingredients_wednesday,
      plan.ingredients_thursday,
      plan.ingredients_friday,
      plan.ingredients_saturday,
      plan.ingredients_sunday
    ];
  }
};

// Feeding action database operations
const feedingActionDb = {
  // Create a new feeding action
  createFeedingAction(feedingData) {
    const { 
      id, 
      nutritionPlanId, 
      petId, 
      ingredients, 
      petSignature, 
      transactionSignature, 
      transactionHash,
      recordedBy
    } = feedingData;
    const now = new Date().toISOString();
    
    // Verify nutrition plan exists
    const plan = nutritionPlanDb.getNutritionPlanById(nutritionPlanId);
    if (!plan) {
      throw new Error(`Nutrition plan not found: ${nutritionPlanId}`);
    }
    
    // Verify pet exists
    const pet = petDb.getPetById(petId);
    if (!pet) {
      throw new Error(`Pet not found: ${petId}`);
    }
    
    // Verify plan is linked to pet
    if (plan.pet_id !== petId) {
      throw new Error(`Nutrition plan ${nutritionPlanId} not linked to pet ${petId}`);
    }
    
    const stmt = db.prepare(`
      INSERT INTO feeding_actions (
        id, nutrition_plan_id, pet_id, ingredients, pet_signature, 
        transaction_signature, transaction_hash, recorded_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, nutritionPlanId, petId, ingredients, petSignature, 
      transactionSignature || null, transactionHash || null, recordedBy || null, now, now
    );
    
    return feedingActionDb.getFeedingActionById(id);
  },
  
  // Get feeding action by ID
  getFeedingActionById(id) {
    const stmt = db.prepare('SELECT * FROM feeding_actions WHERE id = ?');
    return stmt.get(id);
  },
  
  // Get all feeding actions for a nutrition plan
  getFeedingActionsByPlanId(nutritionPlanId) {
    const stmt = db.prepare('SELECT * FROM feeding_actions WHERE nutrition_plan_id = ? ORDER BY created_at DESC');
    return stmt.all(nutritionPlanId);
  },
  
  // Get all feeding actions for a pet
  getFeedingActionsByPetId(petId) {
    const stmt = db.prepare('SELECT * FROM feeding_actions WHERE pet_id = ? ORDER BY created_at DESC');
    return stmt.all(petId);
  },
  
  // Get feeding action by transaction hash
  getFeedingActionByTransactionHash(transactionHash) {
    const stmt = db.prepare('SELECT * FROM feeding_actions WHERE transaction_hash = ?');
    return stmt.get(transactionHash);
  }
};

// HealthCred database helpers
const credentialDb = {
  // Create new credential
  createCredential({
    id,
    walletAddress,
    fullName,
    dateOfBirth,
    email,
    profession,
    didDocumentJson,
    didDocumentHash,
    didId,
    authenticationMethods,
    sasCredentialId,
    mintAddress,
    transactionSignature,
    transactionHash
  }) {
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO credentials (
        id, wallet_address, full_name, date_of_birth, email, profession,
        did_document_json, did_document_hash, did_id, authentication_methods,
        sas_credential_id, mint_address, transaction_signature, transaction_hash,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, walletAddress, fullName, dateOfBirth, email, profession,
      didDocumentJson, didDocumentHash, didId, authenticationMethods || null,
      sasCredentialId || null, mintAddress || null,
      transactionSignature || null, transactionHash || null, now, now
    );
    
    return credentialDb.getCredentialById(id);
  },
  
  // Get credential by ID
  getCredentialById(id) {
    const stmt = db.prepare('SELECT * FROM credentials WHERE id = ?');
    const row = stmt.get(id);
    if (row && row.did_document_json) {
      row.did_document_json = JSON.parse(row.did_document_json);
      row.authentication_methods = row.authentication_methods ? JSON.parse(row.authentication_methods) : [];
    }
    return row;
  },
  
  // Get credential by wallet address
  getCredentialByWallet(walletAddress) {
    const stmt = db.prepare('SELECT * FROM credentials WHERE wallet_address = ?');
    const row = stmt.get(walletAddress);
    if (row && row.did_document_json) {
      row.did_document_json = JSON.parse(row.did_document_json);
      row.authentication_methods = row.authentication_methods ? JSON.parse(row.authentication_methods) : [];
    }
    return row;
  },
  
  // Get credential by DID ID
  getCredentialByDidId(didId) {
    const stmt = db.prepare('SELECT * FROM credentials WHERE did_id = ?');
    const row = stmt.get(didId);
    if (row && row.did_document_json) {
      row.did_document_json = JSON.parse(row.did_document_json);
      row.authentication_methods = row.authentication_methods ? JSON.parse(row.authentication_methods) : [];
    }
    return row;
  },
  
  // Get all credentials with pagination
  getAllCredentials(limit = 10, offset = 0) {
    const stmt = db.prepare('SELECT * FROM credentials ORDER BY created_at DESC LIMIT ? OFFSET ?');
    const rows = stmt.all(limit, offset);
    return rows.map(row => {
      if (row.did_document_json) {
        row.did_document_json = JSON.parse(row.did_document_json);
        row.authentication_methods = row.authentication_methods ? JSON.parse(row.authentication_methods) : [];
      }
      return row;
    });
  },
  
  // Get total credential count
  getCredentialCount() {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM credentials');
    return stmt.get().count;
  }
};

// Badge database helpers
const badgeDb = {
  // Create new badge
  createBadge({
    id,
    credentialId,
    issuerWallet,
    emoji,
    description,
    mintAddress,
    transactionSignature,
    transactionHash
  }) {
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO badges (
        id, credential_id, issuer_wallet, emoji, description,
        mint_address, transaction_signature, transaction_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, credentialId, issuerWallet, emoji, description,
      mintAddress || null, transactionSignature || null, transactionHash || null, now
    );
    
    return badgeDb.getBadgeById(id);
  },
  
  // Get badge by ID
  getBadgeById(id) {
    const stmt = db.prepare('SELECT * FROM badges WHERE id = ?');
    return stmt.get(id);
  },
  
  // Get all badges for a credential
  getBadgesByCredentialId(credentialId) {
    const stmt = db.prepare('SELECT * FROM badges WHERE credential_id = ? ORDER BY created_at DESC');
    return stmt.all(credentialId);
  },
  
  // Get all badges by issuer wallet
  getBadgesByIssuer(issuerWallet) {
    const stmt = db.prepare('SELECT * FROM badges WHERE issuer_wallet = ? ORDER BY created_at DESC');
    return stmt.all(issuerWallet);
  }
};

// Certification database helpers
const certificationDb = {
  // Create new certification
  createCertification({
    id,
    credentialId,
    issuerWallet,
    certificationName,
    filename,
    fileHash,
    fileSize,
    fileType,
    transactionSignature,
    transactionHash
  }) {
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO certifications (
        id, credential_id, issuer_wallet, certification_name, filename, file_hash,
        file_size, file_type, transaction_signature, transaction_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, credentialId, issuerWallet, certificationName || null, filename, fileHash,
      fileSize || null, fileType || null,
      transactionSignature || null, transactionHash || null, now
    );
    
    return certificationDb.getCertificationById(id);
  },
  
  // Get certification by ID
  getCertificationById(id) {
    const stmt = db.prepare('SELECT * FROM certifications WHERE id = ?');
    return stmt.get(id);
  },
  
  // Get all certifications for a credential
  getCertificationsByCredentialId(credentialId) {
    const stmt = db.prepare('SELECT * FROM certifications WHERE credential_id = ? ORDER BY created_at DESC');
    return stmt.all(credentialId);
  },
  
  // Get all certifications by issuer wallet
  getCertificationsByIssuer(issuerWallet) {
    const stmt = db.prepare('SELECT * FROM certifications WHERE issuer_wallet = ? ORDER BY created_at DESC');
    return stmt.all(issuerWallet);
  }
};

// Export database and helper functions (do NOT initialize on require)
module.exports = { db, petDb, vaccinationDb, nutritionPlanDb, feedingActionDb, credentialDb, badgeDb, certificationDb, initializeDatabase, runMigrations };
