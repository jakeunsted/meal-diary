import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';
import {
  User,
  FamilyGroup,
  ShoppingList,
  MealDiary,
  DailyMeal,
  ShoppingListCategory,
  ShoppingListItem,
  Recipe,
  RecipeIngredient,
} from '../db/models/associations.ts';

/**
 * Delete a family group and every row scoped to it, inside the given
 * transaction. Deletion order respects foreign key constraints:
 * daily meals -> meal diaries, items -> categories -> shopping list,
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
    await ShoppingListCategory.destroy({
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

  await User.update(
    { family_group_id: null },
    { where: { family_group_id: familyGroupId }, transaction }
  );
  await FamilyGroup.destroy({ where: { id: familyGroupId }, transaction });
};
