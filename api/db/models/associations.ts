import User from './User.ts';
import FamilyGroup from './FamilyGroup.ts';
import ShoppingList from './ShoppingList.ts';
import MealDiary from './MealDiary.ts';
import DailyMeal from './DailyMeal.ts';

// User <-> FamilyGroup associations
User.belongsTo(FamilyGroup, { 
  foreignKey: 'family_group_id' 
});
FamilyGroup.hasMany(User, {
  foreignKey: 'family_group_id'
});
FamilyGroup.belongsTo(User, { 
  foreignKey: 'created_by',
  as: 'Creator' 
});

// FamilyGroup <-> ShoppingList associations
FamilyGroup.hasOne(ShoppingList, { 
  foreignKey: 'family_group_id',
  as: 'shoppingList'
});
ShoppingList.belongsTo(FamilyGroup, { 
  foreignKey: 'family_group_id'
});

// FamilyGroup <-> MealDiary associations
FamilyGroup.hasMany(MealDiary, {
  foreignKey: 'family_group_id'
});
MealDiary.belongsTo(FamilyGroup, {
  foreignKey: 'family_group_id'
});

// MealDiary <-> DailyMeal associations
MealDiary.hasMany(DailyMeal, {
  foreignKey: 'meal_diary_id'
});
DailyMeal.belongsTo(MealDiary, {
  foreignKey: 'meal_diary_id'
});

// Export all models
export {
  User,
  FamilyGroup,
  ShoppingList,
  MealDiary,
  DailyMeal,
};
