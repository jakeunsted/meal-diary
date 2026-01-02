import { seedDefaultItemCategories, unseedDefaultItemCategories } from './001-default-item-categories.ts';

export { seedDefaultItemCategories, unseedDefaultItemCategories };

/**
 * Runs all seeders
 */
export const runAllSeeds = async (): Promise<void> => {
  await seedDefaultItemCategories();
};

/**
 * Removes all seeded data
 */
export const removeAllSeeds = async (): Promise<void> => {
  await unseedDefaultItemCategories();
};

