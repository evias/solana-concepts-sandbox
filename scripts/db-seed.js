#!/usr/bin/env node

/**
 * Database Seeding Script
 * 
 * Populates database with sample data for development/testing.
 * Usage: npm run db:seed
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

console.log('🌱 Seeding database...');

try {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  
  // Sample pets
  const samplePets = [
    {
      id: 'pet_buddy',
      name: 'Buddy',
      species: 'Dog',
      breed: 'Golden Retriever',
      age: 3,
      owner: 'owner_test',
      mandateAuthority: 'owner_test',
      mintAddress: 'mint_buddy',
      tokenAccount: 'token_buddy'
    },
    {
      id: 'pet_whiskers',
      name: 'Whiskers',
      species: 'Cat',
      breed: 'Siamese',
      age: 2,
      owner: 'owner_test',
      mandateAuthority: 'owner_test',
      mintAddress: 'mint_whiskers',
      tokenAccount: 'token_whiskers'
    },
    {
      id: 'pet_max',
      name: 'Max',
      species: 'Dog',
      breed: 'German Shepherd',
      age: 5,
      owner: 'owner_test2',
      mandateAuthority: 'owner_test2',
      mintAddress: 'mint_max',
      tokenAccount: 'token_max'
    }
  ];
  
  // Insert pets
  const insertPetStmt = db.prepare(`
    INSERT INTO pets (id, name, species, breed, age, owner, mandate_authority, mint_address, token_account, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  let petCount = 0;
  
  for (const pet of samplePets) {
    insertPetStmt.run(
      pet.id,
      pet.name,
      pet.species,
      pet.breed,
      pet.age,
      pet.owner,
      pet.mandateAuthority,
      pet.mintAddress,
      pet.tokenAccount,
      now,
      now
    );
    console.log(`  ✓ Added pet: ${pet.name}`);
    petCount++;
  }
  
  // Sample vaccinations
  const sampleVaccinations = [
    {
      id: 'vax_buddy_rabies',
      petId: 'pet_buddy',
      vaccineName: 'Rabies',
      vaccinationDate: '2026-05-20',
      vetAddress: 'vet_clinic_1',
      vetMandateAuthority: 'vet_clinic_1',
      notes: 'Annual rabies booster'
    },
    {
      id: 'vax_buddy_dppe',
      petId: 'pet_buddy',
      vaccineName: 'DPPE',
      vaccinationDate: '2026-05-15',
      vetAddress: 'vet_clinic_1',
      vetMandateAuthority: 'vet_clinic_1',
      notes: 'Distemper, Parvovirus, Parainfluenza, Enteritis'
    },
    {
      id: 'vax_whiskers_fvrcp',
      petId: 'pet_whiskers',
      vaccineName: 'FVRCP',
      vaccinationDate: '2026-04-10',
      vetAddress: 'vet_clinic_2',
      vetMandateAuthority: 'vet_clinic_2',
      notes: 'Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia'
    },
    {
      id: 'vax_max_rabies',
      petId: 'pet_max',
      vaccineName: 'Rabies',
      vaccinationDate: '2026-03-01',
      vetAddress: 'vet_clinic_1',
      vetMandateAuthority: 'vet_clinic_1',
      notes: '3-year rabies'
    }
  ];
  
  // Insert vaccinations
  const insertVaxStmt = db.prepare(`
    INSERT INTO vaccinations (id, pet_id, vaccine_name, vaccination_date, vet_address, vet_mandate_authority, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let vaxCount = 0;
  
  for (const vax of sampleVaccinations) {
    insertVaxStmt.run(
      vax.id,
      vax.petId,
      vax.vaccineName,
      vax.vaccinationDate,
      vax.vetAddress,
      vax.vetMandateAuthority,
      vax.notes,
      now,
      now
    );
    console.log(`  ✓ Added vaccination: ${vax.vaccineName} for ${vax.petId}`);
    vaxCount++;
  }
  
  db.close();
  
  console.log(`\n✅ Database seeded successfully!`);
  console.log(`   Added ${petCount} pets and ${vaxCount} vaccinations`);
  console.log('\nNext steps:');
  console.log('  1. npm run db:migrate   # Apply migrations');
  console.log('  2. npm start            # Start the server');
  
} catch (error) {
  console.error('❌ Seeding failed:', error.message);
  process.exit(1);
}
