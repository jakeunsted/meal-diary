// test/globalSetup.ts
import { sequelize, User, FamilyGroup, initializeDatabase } from '../db/db.ts';
import { Op } from 'sequelize';

export async function setup() {
  console.log('Global setup: Initializing database...');
  await initializeDatabase;
  console.log('Global setup: Database initialized.');
}

export async function teardown() {
  console.log('Global teardown: Cleaning up database...');
  await FamilyGroup.destroy({ where: { name: { [Op.like]: 'Vitest -%' } } });
  await User.destroy({ where: { username: { [Op.like]: 'vitest_%' } } });
  await sequelize.close();
  console.log('Global teardown: Database cleaned up.');
}