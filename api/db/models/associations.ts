import User from './User.model.ts';
import FamilyGroup from './FamilyGroup.model.ts';
import ShoppingList from './ShoppingList.model.ts';
import MealDiary from './MealDiary.model.ts';
import DailyMeal from './DailyMeal.model.ts';
import RefreshToken from './RefreshToken.model.ts';
import Recipe from './Recipe.model.ts';
import Ingredient from './Ingredient.model.ts';
import RecipeIngredient from './RecipeIngredient.model.ts';

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

// User <-> RefreshToken associations
RefreshToken.belongsTo(User, {
  foreignKey: 'user_id',
  foreignKeyConstraint: true,
  as: 'user'
});
User.hasOne(RefreshToken, {
  foreignKey: 'user_id',
  foreignKeyConstraint: true,
  as: 'refreshToken'
});

// User <-> Recipe associations
User.hasMany(Recipe, {
  foreignKey: 'created_by',
  foreignKeyConstraint: true,
  as: 'recipes'
});
Recipe.belongsTo(User, {
  foreignKey: 'created_by',
  foreignKeyConstraint: true,
  as: 'creator'
});

// Recipe <-> Ingredient associations (through RecipeIngredient)
Recipe.belongsToMany(Ingredient, {
  through: RecipeIngredient,
  foreignKey: 'recipe_id',
  otherKey: 'ingredient_id',
  as: 'ingredients'
});
Ingredient.belongsToMany(Recipe, {
  through: RecipeIngredient,
  foreignKey: 'ingredient_id',
  otherKey: 'recipe_id',
  as: 'recipes'
});

// RecipeIngredient associations
RecipeIngredient.belongsTo(Recipe, {
  foreignKey: 'recipe_id',
  foreignKeyConstraint: true
});
RecipeIngredient.belongsTo(Ingredient, {
  foreignKey: 'ingredient_id',
  foreignKeyConstraint: true
});

// Export all models
export {
  User,
  FamilyGroup,
  ShoppingList,
  MealDiary,
  DailyMeal,
  RefreshToken,
  Recipe,
  Ingredient,
  RecipeIngredient
};
