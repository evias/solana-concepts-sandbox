#!/usr/bin/env node

/**
 * Database TABLE Reset Script
 * 
 * CAUTION: Empties a database table completely.
 * Usage: npm run db:reset -- tw_token_prices
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'sandbox.db');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found at: ${dbPath}`);
  console.error(`   Run: npm run db:init`);
  process.exit(1);
}

if (process.argv.length !== 4) {
  console.error(`❌ Missing obligatory arguments.`)
  console.error(`Usage: SCS_DB_TABLE=table_name npm run db:reset`);
  process.exit(1);
}

const tableName = process.argv[3];
console.log('🌱 Resetting database table: ', tableName);

try {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Empty database table
  db.exec(`
    DELETE FROM ${tableName} WHERE TRUE
  `);

  console.log('🌱 Database table reset successfully!');
} catch (error) {
  console.error('❌ Reset failed:', error.message);
  process.exit(1);
}
  