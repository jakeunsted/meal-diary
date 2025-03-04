import User from './User.model.ts';
import FamilyGroup from './FamilyGroup.model.ts';
import ShoppingList from './ShoppingList.model.ts';
import MealDiary from './MealDiary.model.ts';
import DailyMeal from './DailyMeal.model.ts';

// User <-> FamilyGroup associations
User.belongsTo(FamilyGroup, { 
  foreignKey: 'family_group_id',
  foreignKeyConstraint: true,
});
FamilyGroup.hasMany(User, {
  foreignKey: 'family_group_id',
  foreignKeyConstraint: true,
});

// FamilyGroup <-> ShoppingList associations
FamilyGroup.hasOne(ShoppingList, { 
  foreignKey: 'family_group_id',
  foreignKeyConstraint: true,
  as: 'shoppingList'
});
ShoppingList.belongsTo(FamilyGroup, { 
  foreignKey: 'family_group_id',
  foreignKeyConstraint: true
});

// FamilyGroup <-> MealDiary associations
FamilyGroup.hasMany(MealDiary, {
  foreignKey: 'family_group_id',
  foreignKeyConstraint: true
});
MealDiary.belongsTo(FamilyGroup, {
  foreignKey: 'family_group_id',
  foreignKeyConstraint: true
});

// MealDiary <-> DailyMeal associations
MealDiary.hasMany(DailyMeal, {
  foreignKey: 'meal_diary_id',
  foreignKeyConstraint: true
});
DailyMeal.belongsTo(MealDiary, {
  foreignKey: 'meal_diary_id',
  foreignKeyConstraint: true
});

// Export all models
export {
  User,
  FamilyGroup,
  ShoppingList,
  MealDiary,
  DailyMeal,
};
