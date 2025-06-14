import User from './User.model.ts';
import FamilyGroup from './FamilyGroup.model.ts';
import ShoppingList from './ShoppingList.model.ts';
import MealDiary from './MealDiary.model.ts';
import DailyMeal from './DailyMeal.model.ts';
import RefreshToken from './RefreshToken.model.ts';
import ItemCategory from './ItemCategory.model.ts';
import ShoppingListCategory from './ShoppingListCategory.model.ts';
import ShoppingListItem from './ShoppingListItem.model.ts';

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

// ShoppingList <-> ShoppingListCategory associations
ShoppingList.hasMany(ShoppingListCategory, {
  foreignKey: 'shopping_list_id',
  foreignKeyConstraint: true,
  as: 'categories'
});
ShoppingListCategory.belongsTo(ShoppingList, {
  foreignKey: 'shopping_list_id',
  foreignKeyConstraint: true
});

// ItemCategory <-> ShoppingListCategory associations
ItemCategory.hasMany(ShoppingListCategory, {
  foreignKey: 'item_categories_id',
  foreignKeyConstraint: true,
  as: 'shoppingListCategories'
});
ShoppingListCategory.belongsTo(ItemCategory, {
  foreignKey: 'item_categories_id',
  foreignKeyConstraint: true,
  as: 'itemCategory'
});

// ShoppingListCategory <-> ShoppingListItem associations
ShoppingListCategory.hasMany(ShoppingListItem, {
  foreignKey: 'shopping_list_categories',
  foreignKeyConstraint: true,
  as: 'items'
});
ShoppingListItem.belongsTo(ShoppingListCategory, {
  foreignKey: 'shopping_list_categories',
  foreignKeyConstraint: true
});

// ShoppingList <-> ShoppingListItem associations
ShoppingList.hasMany(ShoppingListItem, {
  foreignKey: 'shopping_list_id',
  foreignKeyConstraint: true,
  as: 'items'
});
ShoppingListItem.belongsTo(ShoppingList, {
  foreignKey: 'shopping_list_id',
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

// Export all models
export {
  User,
  FamilyGroup,
  ShoppingList,
  MealDiary,
  DailyMeal,
  RefreshToken,
  ItemCategory,
  ShoppingListCategory,
  ShoppingListItem
};
