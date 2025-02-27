import sequelize from './models/index.ts';
import './models/associations.ts';
import { User, FamilyGroup, ShoppingList, MealDiary, DailyMeal } from './models/associations.ts';

const initializeDatabase = async (force = false) => {
  try {
    // Test the connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync all models
    await sequelize.sync({ force });
    console.log('Database synchronized successfully.');
    
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

export {
  sequelize,
  initializeDatabase,
  User,
  FamilyGroup,
  ShoppingList,
  MealDiary,
  DailyMeal,
};
