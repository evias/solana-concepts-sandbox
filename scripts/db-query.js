#!/usr/bin/env node

/**
 * Database query script
 * 
 * CAUTION: Executes raw queries against database.
 * Usage: node scripts/db-query.js -- "SELECT count(*) from tw_token_prices;"
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
  console.error(`Usage: node scripts/db-query.js -- "SELECT count(*) from tw_token_prices;"`);
  process.exit(1);
}

const rawQuery = process.argv[3];

try {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Empty database table
  const stmt = db.prepare(`${rawQuery}`);

  let result;
  if (rawQuery.toLowerCase().indexOf('select') === 0) {
    result = stmt.all();
  } else {
    result = stmt.run();
  }

  console.log("Result: ", result);
} catch (error) {
  console.error('❌ Reset failed:', error.message);
  process.exit(1);
}
  