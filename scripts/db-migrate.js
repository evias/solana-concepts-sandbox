#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * Applies pending migrations from the repository.
 * Migrations are tracked via DBHEAD file which contains the count of applied migrations.
 * Usage: npm run db:migrate
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'pettracker.db');
const dbheadPath = path.join(__dirname, '..', 'DBHEAD');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found at: ${dbPath}`);
  console.error(`   Run: npm run db:init && npm run db:seed`);
  process.exit(1);
}

// Check if DBHEAD exists
if (!fs.existsSync(dbheadPath)) {
  console.error(`❌ DBHEAD file not found at: ${dbheadPath}`);
  console.error(`   This file tracks which migrations have been applied.`);
  process.exit(1);
}

console.log('🔄 Checking for pending migrations...');

try {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  
  // Read current migration count from DBHEAD
  const currentMigrationCount = parseInt(fs.readFileSync(dbheadPath, 'utf-8').trim(), 10);
  
  console.log(`   Current migration level: ${currentMigrationCount}`);
  
  // Define all migrations (indexed by migration number)
  const migrations = [
    // Migration 1: Add mandate_authority to pets
    {
      name: 'Add mandate_authority column to pets',
      up: (db) => {
        try {
          const petTableInfo = db.prepare("PRAGMA table_info(pets)").all();
          const hasMandate = petTableInfo.some(col => col.name === 'mandate_authority');
          
          if (!hasMandate) {
            db.exec(`ALTER TABLE pets ADD COLUMN mandate_authority TEXT;`);
            db.prepare(`UPDATE pets SET mandate_authority = owner WHERE mandate_authority IS NULL`).run();
            return true;
          }
          return false;
        } catch (error) {
          if (error.message.includes('duplicate column')) {
            return false;
          }
          throw error;
        }
      }
    },
    
    // Migration 2: Add transaction_signature to vaccinations
    {
      name: 'Add transaction_signature column to vaccinations',
      up: (db) => {
        try {
          const vaxTableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
          const hasTxSig = vaxTableInfo.some(col => col.name === 'transaction_signature');
          
          if (!hasTxSig) {
            db.exec(`ALTER TABLE vaccinations ADD COLUMN transaction_signature TEXT;`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_sig ON vaccinations(transaction_signature);`);
            return true;
          }
          return false;
        } catch (error) {
          if (error.message.includes('duplicate column')) {
            return false;
          }
          throw error;
        }
      }
    },
    
    // Migration 3: Add transaction_hash to vaccinations
    {
      name: 'Add transaction_hash column to vaccinations',
      up: (db) => {
        try {
          const vaxTableInfo = db.prepare("PRAGMA table_info(vaccinations)").all();
          const hasTxHash = vaxTableInfo.some(col => col.name === 'transaction_hash');
          
          if (!hasTxHash) {
            db.exec(`ALTER TABLE vaccinations ADD COLUMN transaction_hash TEXT;`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_hash ON vaccinations(transaction_hash);`);
            return true;
          }
          return false;
        } catch (error) {
          if (error.message.includes('duplicate column')) {
            return false;
          }
          throw error;
        }
      }
    },
    
     // Migration 4: Update mint_address for existing vaccinations
     {
       name: 'Update mint_address for existing vaccinations from SPL token recording',
       up: (db) => {
         try {
           // Update vaccination vax_1779533855468 with mint address
           db.prepare(`UPDATE vaccinations SET mint_address = ? WHERE id = ?`).run(
             '9XoXMYBMYZs51w9EpyQt9aELMAGReLHZiuo3KYbFvxj',
             'vax_1779533855468'
           );
           
           // Update vaccination vax_1779448067318 with mint address
           db.prepare(`UPDATE vaccinations SET mint_address = ? WHERE id = ?`).run(
             'CGNQGjhDyoSCsrv4RLbrVBdutHLX9xjqgzZsnEt1V1oa',
             'vax_1779448067318'
           );
           
           console.log('    ✓ Updated mint addresses for 2 vaccinations');
           return true;
         } catch (error) {
           console.error('    Error updating mint addresses:', error.message);
           throw error;
         }
       }
     },
     
      // Migration 5: Create nutrition_plans and feeding_actions tables
      {
        name: 'Create nutrition_plans and feeding_actions tables for PetDiet',
        up: (db) => {
          try {
            // Check if tables already exist
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            const tableNames = tables.map(t => t.name);
            
            let created = false;
            
            if (!tableNames.includes('nutrition_plans')) {
              db.exec(`
                CREATE TABLE nutrition_plans (
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
              created = true;
            }
            
            if (!tableNames.includes('feeding_actions')) {
              db.exec(`
                CREATE TABLE feeding_actions (
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
              created = true;
            }
            
            return created;
          } catch (error) {
            if (error.message.includes('already exists')) {
              return false;
            }
            throw error;
          }
        }
      },
      
       // Migration 6: Add recorded_by column to feeding_actions
       {
         name: 'Add recorded_by column to feeding_actions',
         up: (db) => {
           try {
             const feedingTableInfo = db.prepare("PRAGMA table_info(feeding_actions)").all();
             const hasRecordedBy = feedingTableInfo.some(col => col.name === 'recorded_by');
             
             if (!hasRecordedBy) {
               db.exec(`ALTER TABLE feeding_actions ADD COLUMN recorded_by TEXT;`);
               return true;
             }
             return false;
           } catch (error) {
             if (error.message.includes('duplicate column')) {
               return false;
             }
             throw error;
           }
         }
       },
       
       // Migration 7: Create HealthCred tables (credentials, badges, certifications)
       {
         name: 'Create HealthCred credentials, badges, and certifications tables',
         up: (db) => {
           try {
             const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
             const tableNames = tables.map(t => t.name);
             
             let created = false;
             
             if (!tableNames.includes('credentials')) {
               db.exec(`
                 CREATE TABLE credentials (
                   id TEXT PRIMARY KEY,
                   wallet_address TEXT NOT NULL UNIQUE,
                   full_name TEXT NOT NULL,
                   date_of_birth TEXT NOT NULL,
                   email TEXT NOT NULL,
                   profession TEXT NOT NULL,
                   did_document_json TEXT NOT NULL,
                   did_document_hash TEXT NOT NULL,
                   did_id TEXT NOT NULL,
                   authentication_methods TEXT,
                   sas_credential_id TEXT,
                   mint_address TEXT,
                   transaction_signature TEXT,
                   transaction_hash TEXT,
                   created_at TEXT NOT NULL,
                   updated_at TEXT NOT NULL
                 );
                 
                 CREATE INDEX IF NOT EXISTS idx_cred_wallet ON credentials(wallet_address);
                 CREATE INDEX IF NOT EXISTS idx_cred_did_id ON credentials(did_id);
                 CREATE INDEX IF NOT EXISTS idx_cred_email ON credentials(email);
               `);
               created = true;
             }
             
             if (!tableNames.includes('badges')) {
               db.exec(`
                 CREATE TABLE badges (
                   id TEXT PRIMARY KEY,
                   credential_id TEXT NOT NULL,
                   issuer_wallet TEXT NOT NULL,
                   emoji TEXT NOT NULL,
                   description TEXT NOT NULL,
                   mint_address TEXT,
                   transaction_signature TEXT,
                   transaction_hash TEXT,
                   created_at TEXT NOT NULL,
                   FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE CASCADE
                 );
                 
                 CREATE INDEX IF NOT EXISTS idx_badge_credential ON badges(credential_id);
                 CREATE INDEX IF NOT EXISTS idx_badge_issuer ON badges(issuer_wallet);
                 CREATE INDEX IF NOT EXISTS idx_badge_tx_sig ON badges(transaction_signature);
               `);
               created = true;
             }
             
             if (!tableNames.includes('certifications')) {
               db.exec(`
                 CREATE TABLE certifications (
                   id TEXT PRIMARY KEY,
                   credential_id TEXT NOT NULL,
                   issuer_wallet TEXT NOT NULL,
                   filename TEXT NOT NULL,
                   file_hash TEXT NOT NULL,
                   file_size INTEGER,
                   file_type TEXT,
                   mint_address TEXT,
                   transaction_signature TEXT,
                   transaction_hash TEXT,
                   created_at TEXT NOT NULL,
                   FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE CASCADE
                 );
                 
                 CREATE INDEX IF NOT EXISTS idx_cert_credential ON certifications(credential_id);
                 CREATE INDEX IF NOT EXISTS idx_cert_issuer ON certifications(issuer_wallet);
                 CREATE INDEX IF NOT EXISTS idx_cert_tx_sig ON certifications(transaction_signature);
               `);
               created = true;
             }
             
             return created;
           } catch (error) {
             if (error.message.includes('already exists')) {
               return false;
             }
              throw error;
            }
          }
        },
    
        // Migration 8: Remove UNIQUE constraint on wallet_address in credentials table
        // Allow multiple credentials per wallet; uniqueness is on did_document_hash
        {
          name: 'Remove UNIQUE constraint on wallet_address in credentials table',
          up: (db) => {
            try {
              // Check if the UNIQUE constraint still exists
              const indexInfo = db.prepare("PRAGMA index_info(sqlite_autoindex_credentials_1)").all();
              
              // If we can't find the autoindex, the constraint might already be removed
              if (indexInfo.length === 0) {
                return false; // Already removed or doesn't exist
              }
              
              // Rebuild credentials table without UNIQUE on wallet_address
              db.exec(`
                CREATE TABLE credentials_new (
                  id TEXT PRIMARY KEY,
                  wallet_address TEXT NOT NULL,
                  full_name TEXT NOT NULL,
                  date_of_birth TEXT NOT NULL,
                  email TEXT NOT NULL,
                  profession TEXT NOT NULL,
                  did_document_json TEXT NOT NULL,
                  did_document_hash TEXT NOT NULL UNIQUE,
                  did_id TEXT NOT NULL,
                  authentication_methods TEXT,
                  sas_credential_id TEXT,
                  mint_address TEXT,
                  transaction_signature TEXT,
                  transaction_hash TEXT,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
                
                INSERT INTO credentials_new SELECT * FROM credentials;
                DROP TABLE credentials;
                ALTER TABLE credentials_new RENAME TO credentials;
                
                CREATE INDEX IF NOT EXISTS idx_cred_wallet ON credentials(wallet_address);
                CREATE INDEX IF NOT EXISTS idx_cred_did_id ON credentials(did_id);
                CREATE INDEX IF NOT EXISTS idx_cred_email ON credentials(email);
              `);
              
              return true;
            } catch (error) {
              if (error.message.includes('already exists') || error.message.includes('column did_document_hash is not unique')) {
                return false;
              }
              throw error;
            }
          }
        }
    ];
  
  console.log(`   Total migrations defined: ${migrations.length}`);
  
  // Run pending migrations
  let appliedCount = 0;
  
  for (let i = 0; i < migrations.length; i++) {
    const migrationNumber = i + 1;
    
    if (migrationNumber > currentMigrationCount) {
      const migration = migrations[i];
      console.log(`\n  Running migration ${migrationNumber}: ${migration.name}`);
      
      try {
        const applied = migration.up(db);
        if (applied) {
          console.log(`    ✓ Migration ${migrationNumber} applied`);
          appliedCount++;
        } else {
          console.log(`    ⓘ Migration ${migrationNumber} already applied or skipped`);
        }
      } catch (error) {
        console.error(`    ✗ Migration ${migrationNumber} failed:`, error.message);
        process.exit(1);
      }
    }
  }
  
  db.close();
  
  if (appliedCount > 0) {
    console.log(`\n✅ Applied ${appliedCount} pending migration(s)`);
  } else {
    console.log(`\nℹ️  Database is up to date`);
  }
  
  console.log('\nReady to start:');
  console.log('  npm start');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
