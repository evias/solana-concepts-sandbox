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
