import {
  User,
  FamilyGroup,
  MealDiary,
  DailyMeal,
  ShoppingList,
  ShoppingListItem,
  Recipe,
  RecipeIngredient,
} from '../db/models/associations.ts';

export interface UserDataExport {
  exportedAt: string;
  user: Record<string, any>;
  familyGroup: Record<string, any> | null;
  recipes: Record<string, any>[];
  mealDiaries: Record<string, any>[];
  shoppingLists: Record<string, any>[];
}

/**
 * Build a machine-readable export of everything linked to a user (GDPR
 * Art. 15 access / Art. 20 portability): their profile plus the data in the
 * family group they belong to. Credentials are never included — password_hash
 * is stripped and refresh tokens are not queried.
 */
export const exportUserData = async (userId: number): Promise<UserDataExport> => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const userJson = user.toJSON() as Record<string, any>;
  delete userJson.password_hash;

  const familyGroupId = user.dataValues.family_group_id;

  let familyGroup: Record<string, any> | null = null;
  let recipes: Record<string, any>[] = [];
  let mealDiaries: Record<string, any>[] = [];
  let shoppingLists: Record<string, any>[] = [];

  if (familyGroupId) {
    const group = await FamilyGroup.findByPk(familyGroupId);
    familyGroup = group ? (group.toJSON() as Record<string, any>) : null;

    const recipeRows = await Recipe.findAll({
      where: { family_group_id: familyGroupId },
      include: [{ model: RecipeIngredient, as: 'ingredients' }],
      order: [['name', 'ASC']],
    });
    recipes = recipeRows.map((r) => r.toJSON() as Record<string, any>);

    const mealDiaryRows = await MealDiary.findAll({
      where: { family_group_id: familyGroupId },
      include: [{ model: DailyMeal }],
      order: [['week_start_date', 'ASC']],
    });
    mealDiaries = mealDiaryRows.map((d) => d.toJSON() as Record<string, any>);

    const shoppingListRows = await ShoppingList.findAll({
      where: { family_group_id: familyGroupId },
      include: [{ model: ShoppingListItem, as: 'items' }],
    });
    shoppingLists = shoppingListRows.map((s) => s.toJSON() as Record<string, any>);
  }

  return {
    exportedAt: new Date().toISOString(),
    user: userJson,
    familyGroup,
    recipes,
    mealDiaries,
    shoppingLists,
  };
};
