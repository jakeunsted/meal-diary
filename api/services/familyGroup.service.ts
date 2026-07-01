import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';
import sequelize from '../db/models/index.ts';
import {
  User,
  FamilyGroup,
  ShoppingList,
  MealDiary,
  DailyMeal,
  ShoppingListItem,
  Recipe,
  RecipeIngredient,
  Subscription,
} from '../db/models/associations.ts';

/**
 * Delete a family group and every row scoped to it, inside the given
 * transaction. Deletion order respects foreign key constraints:
 * daily meals -> meal diaries, items -> shopping list,
 * ingredients -> recipes, then member unlinking and the group itself.
 */
export const deleteFamilyGroupData = async (
  familyGroupId: number,
  transaction: Transaction
): Promise<void> => {
  const mealDiaries = await MealDiary.findAll({
    where: { family_group_id: familyGroupId },
    transaction,
  });
  const mealDiaryIds = mealDiaries.map(diary => diary.dataValues.id);
  if (mealDiaryIds.length > 0) {
    await DailyMeal.destroy({
      where: { meal_diary_id: { [Op.in]: mealDiaryIds } },
      transaction,
    });
  }
  await MealDiary.destroy({ where: { family_group_id: familyGroupId }, transaction });

  const shoppingLists = await ShoppingList.findAll({
    where: { family_group_id: familyGroupId },
    transaction,
  });
  const shoppingListIds = shoppingLists.map(list => list.dataValues.id);
  if (shoppingListIds.length > 0) {
    await ShoppingListItem.destroy({
      where: { shopping_list_id: { [Op.in]: shoppingListIds } },
      transaction,
    });
  }
  await ShoppingList.destroy({ where: { family_group_id: familyGroupId }, transaction });

  const recipes = await Recipe.findAll({
    where: { family_group_id: familyGroupId },
    transaction,
  });
  const recipeIds = recipes.map(recipe => recipe.dataValues.id);
  if (recipeIds.length > 0) {
    await RecipeIngredient.destroy({
      where: { recipe_id: { [Op.in]: recipeIds } },
      transaction,
    });
  }
  await Recipe.destroy({ where: { family_group_id: familyGroupId }, transaction });

  await Subscription.destroy({ where: { family_group_id: familyGroupId }, transaction });

  await User.update(
    { family_group_id: null },
    { where: { family_group_id: familyGroupId }, transaction }
  );
  await FamilyGroup.destroy({ where: { id: familyGroupId }, transaction });
};

/**
 * Remove the user from a family group. Shared data (meal diaries, recipes,
 * shopping lists) stays with the group. The owner cannot leave — they must
 * transfer ownership or delete the family first, otherwise the group would
 * be orphaned (created_by is a non-null FK).
 */
export const leaveFamilyGroup = async (
  familyGroupId: number,
  userId: number
): Promise<void> => {
  const familyGroup = await FamilyGroup.findByPk(familyGroupId);
  if (!familyGroup) {
    throw new Error('Family group not found');
  }

  if (familyGroup.dataValues.created_by === userId) {
    throw new Error('The family owner cannot leave. Transfer ownership or delete the family first');
  }

  await User.update(
    { family_group_id: null },
    { where: { id: userId, family_group_id: familyGroupId } }
  );
};

/**
 * Transfer family group ownership to another current member.
 * Only the current owner can transfer.
 */
export const transferFamilyGroupOwnership = async (
  familyGroupId: number,
  currentUserId: number,
  newOwnerId: number
): Promise<void> => {
  const familyGroup = await FamilyGroup.findByPk(familyGroupId);
  if (!familyGroup) {
    throw new Error('Family group not found');
  }

  if (familyGroup.dataValues.created_by !== currentUserId) {
    throw new Error('Only the family owner can transfer ownership');
  }

  if (newOwnerId === currentUserId) {
    throw new Error('You already own this family group');
  }

  const newOwner = await User.findByPk(newOwnerId);
  if (!newOwner || newOwner.dataValues.family_group_id !== familyGroupId) {
    throw new Error('The new owner must be a member of the family group');
  }

  await FamilyGroup.update(
    { created_by: newOwnerId },
    { where: { id: familyGroupId } }
  );
};

/**
 * Delete a family group and all of its data. Only the owner can delete.
 */
export const deleteFamilyGroup = async (
  familyGroupId: number,
  userId: number
): Promise<void> => {
  const familyGroup = await FamilyGroup.findByPk(familyGroupId);
  if (!familyGroup) {
    throw new Error('Family group not found');
  }

  if (familyGroup.dataValues.created_by !== userId) {
    throw new Error('Only the family owner can delete the family group');
  }

  await sequelize.transaction(async (transaction) => {
    await deleteFamilyGroupData(familyGroupId, transaction);
  });
};
