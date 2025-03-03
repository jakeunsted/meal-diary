import { beforeAll, afterAll, beforeEach } from 'vitest';
import { sequelize, User, FamilyGroup, initializeDatabase } from '../db/db.ts';
import {Op} from 'sequelize'

beforeAll(async () => {
  // Wait for database connection to be established
  await initializeDatabase;
}, 30000);

afterAll(async () => {
  // Close database connection after tests
  await sequelize.close();
}, 30000);

beforeEach(async () => {
  await FamilyGroup.destroy({ where: { name: { [Op.like]: 'Vitest -%' } } });
  await User.destroy({ where: { username: { [Op.like]: 'vitest_%' } } });

}, 15000);
