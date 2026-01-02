import dotenv from 'dotenv';
import { initializeDatabase } from '../db/db.ts';
import '../db/models/associations.ts';
import { runAllSeeds } from '../db/seeders/index.ts';

dotenv.config();

/**
 * Script to seed the database with default data
 * Usage: npm run seed
 */
(async () => {
  try {
    console.log('Starting database seeding...');

    // Initialize database connection and sync models
    const dbInitialized = await initializeDatabase(false);
    if (!dbInitialized) {
      console.error('Failed to initialize database');
      process.exit(1);
    }

    // Run all seeds
    await runAllSeeds();

    console.log('Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
})();

