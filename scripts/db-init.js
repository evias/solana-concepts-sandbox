#!/usr/bin/env node

/**
 * Database Initialization Script
 * 
 * Creates a fresh database with schema but no data.
 * Usage: npm run db:init
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'pettracker.db');

// Check if database already exists
if (fs.existsSync(dbPath)) {
  console.error(`❌ Database already exists at: ${dbPath}`);
  console.error(`   To reset: rm ${dbPath}`);
  process.exit(1);
}

console.log('🔧 Initializing database...');

try {
  // Create fresh database
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create pets table
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
    
    CREATE INDEX idx_owner ON pets(owner);
    CREATE INDEX idx_mandate ON pets(mandate_authority);
    CREATE INDEX idx_mint ON pets(mint_address);
  `);
  
  console.log('  ✓ Created pets table');
  
  // Create vaccinations table
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
    
    CREATE INDEX idx_pet_id ON vaccinations(pet_id);
    CREATE INDEX idx_vet ON vaccinations(vet_address);
    CREATE INDEX idx_vax_mint ON vaccinations(mint_address);
    CREATE INDEX idx_tx_sig ON vaccinations(transaction_signature);
    CREATE INDEX idx_tx_hash ON vaccinations(transaction_hash);
  `);
  
  console.log('  ✓ Created vaccinations table');
  
  db.close();
  
  console.log(`\n✅ Database initialized successfully at:\n   ${dbPath}`);
  console.log('\nNext steps:');
  console.log('  1. npm run db:seed      # Add sample data');
  console.log('  2. npm run db:migrate   # Apply migrations');
  console.log('  3. npm start            # Start the server');
  
} catch (error) {
  console.error('❌ Initialization failed:', error.message);
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  process.exit(1);
}
