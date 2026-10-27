import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { RecipeCategoryField } from '@/components/recipe/RecipeCategoryField';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';
import { useRecipeCategories } from '@/lib/queries/recipeCategories';
import type {
  CreateRecipePayload,
  Recipe,
  RecipeIngredient,
  UpdateRecipePayload,
} from '@/types/recipe';

export type RecipeFormValues = CreateRecipePayload | UpdateRecipePayload;

interface RecipeFormProps {
  initialData?: Recipe | null;
  submitLabel: string;
  isLoading?: boolean;
  onSubmit: (values: RecipeFormValues) => void;
  onCancel: () => void;
}

interface IngredientDraft {
  name: string;
  quantity: string;
  unit: string;
}

function mapIngredientsToDraft(ingredients?: RecipeIngredient[]): IngredientDraft[] {
  if (!ingredients?.length) {
    return [];
  }

  return ingredients.map((ingredient) => ({
    name: ingredient.name,
    quantity: ingredient.quantity != null ? String(ingredient.quantity) : '',
    unit: ingredient.unit ?? '',
  }));
}

function categoryIdsFromRecipe(recipe: Recipe | null | undefined): number[] | null {
  if (!recipe) {
    return [];
  }

  if (!recipe.categories) {
    return null;
  }

  return recipe.categories.map((category) => category.id);
}

function buildSubmitPayload(
  name: string,
  description: string,
  instructions: string,
  portions: string,
  ingredients: IngredientDraft[],
  categoryIds: number[] | null
): RecipeFormValues {
  const cleanedIngredients = ingredients
    .filter((ingredient) => ingredient.name.trim())
    .map((ingredient) => ({
      name: ingredient.name.trim(),
      quantity: ingredient.quantity.trim() ? Number(ingredient.quantity) : null,
      unit: ingredient.unit.trim() || null,
    }));

  return {
    name: name.trim(),
    description: description.trim() || undefined,
    instructions: instructions.trim() || undefined,
    portions: portions.trim() ? Number.parseInt(portions, 10) : undefined,
    ingredients: cleanedIngredients,
    ...(categoryIds != null ? { category_ids: categoryIds } : {}),
  };
}

export function RecipeForm({
  initialData,
  submitLabel,
  isLoading = false,
  onSubmit,
  onCancel,
}: RecipeFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [instructions, setInstructions] = useState(initialData?.instructions ?? '');
  const [portions, setPortions] = useState(
    initialData?.portions != null ? String(initialData.portions) : ''
  );
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    mapIngredientsToDraft(initialData?.ingredients)
  );
  const [categoryIds, setCategoryIds] = useState<number[] | null>(() =>
    categoryIdsFromRecipe(initialData)
  );
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const entitlementsQuery = useEntitlements(familyGroupId);
  const categoriesQuery = useRecipeCategories(familyGroupId);
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const visibleCategories = categoriesQuery.data ?? [];
  const canUseCustomCategories =
    entitlementsQuery.data?.features.custom_recipe_categories === true;
  const showAddCustom = entitlementsQuery.isSuccess && !canUseCustomCategories;
  const selectedCategoryIds =
    categoryIds ?? initialData?.categories?.map((category) => category.id) ?? [];
  const lockedCategories = (initialData?.categories ?? []).filter(
    (category) =>
      category.assignable === false &&
      selectedCategoryIds.includes(category.id) &&
      !visibleCategories.some((visible) => visible.id === category.id)
  );

  useEffect(() => {
    if (!initialData) {
      return;
    }

    setName(initialData.name ?? '');
    setDescription(initialData.description ?? '');
    setInstructions(initialData.instructions ?? '');
    setPortions(initialData.portions != null ? String(initialData.portions) : '');
    setIngredients(mapIngredientsToDraft(initialData.ingredients));
    setCategoryIds(categoryIdsFromRecipe(initialData));
  }, [initialData]);

  const handleToggleCategory = (categoryId: number) => {
    const category = visibleCategories.find((item) => item.id === categoryId);
    if (!category) {
      return;
    }

    const ids = categoryIds ?? initialData?.categories?.map((item) => item.id) ?? [];
    if (ids.includes(categoryId)) {
      setCategoryIds(ids.filter((id) => id !== categoryId));
      return;
    }

    if (!category.assignable || (!category.is_default && showAddCustom)) {
      openPaywall('custom_recipe_categories');
      return;
    }

    setCategoryIds([...ids, categoryId]);
  };

  const handleRemoveLockedCategory = (categoryId: number) => {
    const ids = categoryIds ?? initialData?.categories?.map((item) => item.id) ?? [];
    setCategoryIds(ids.filter((id) => id !== categoryId));
  };

  const handleAddCustomCategory = () => {
    openPaywall('custom_recipe_categories');
  };

  const handleAddIngredient = () => {
    setIngredients((current) => [...current, { name: '', quantity: '', unit: '' }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleIngredientChange = (
    index: number,
    field: keyof IngredientDraft,
    value: string
  ) => {
    setIngredients((current) =>
      current.map((ingredient, itemIndex) =>
        itemIndex === index ? { ...ingredient, [field]: value } : ingredient
      )
    );
  };

  const handleSubmit = () => {
    if (!name.trim() || isLoading) {
      return;
    }

    onSubmit(
      buildSubmitPayload(name, description, instructions, portions, ingredients, categoryIds)
    );
  };

  const inputClassName =
    'rounded-lg border border-white/10 bg-surface px-4 py-3 text-base text-ice';

  return (
    <Box className="gap-4">
      <Box>
        <Text className="mb-2 text-sm font-semibold text-ice">
          {t('recipeForm.recipeName')} *
        </Text>
        <TextInput
          className={inputClassName}
          placeholder={t('recipeForm.recipeName')}
          placeholderTextColor="rgba(241, 245, 249, 0.4)"
          value={name}
          onChangeText={setName}
          testID="recipe-form-name-input"
        />
      </Box>

      <Box>
        <Text className="mb-2 text-sm font-semibold text-ice">
          {t('recipeForm.description')}
        </Text>
        <TextInput
          className={`${inputClassName} min-h-[80px]`}
          placeholder={t('recipeForm.description')}
          placeholderTextColor="rgba(241, 245, 249, 0.4)"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          testID="recipe-form-description-input"
        />
      </Box>

      <Box>
        <Text className="mb-2 text-sm font-semibold text-ice">
          {t('recipeForm.portions')}
        </Text>
        <TextInput
          className={`${inputClassName} w-24`}
          placeholder={t('recipeForm.portions')}
          placeholderTextColor="rgba(241, 245, 249, 0.4)"
          value={portions}
          onChangeText={setPortions}
          keyboardType="number-pad"
          testID="recipe-form-portions-input"
        />
      </Box>

      <RecipeCategoryField
        options={visibleCategories}
        selectedIds={selectedCategoryIds}
        lockedCategories={lockedCategories}
        isLoading={categoriesQuery.isLoading && visibleCategories.length === 0}
        showAddCustom={showAddCustom}
        errorMessage={categoriesQuery.isError ? t('login.networkError') : null}
        onToggle={handleToggleCategory}
        onRemoveLocked={handleRemoveLockedCategory}
        onAddCustom={handleAddCustomCategory}
      />

      <Box>
        <Text className="mb-2 text-sm font-semibold text-ice">
          {t('recipeForm.ingredients')}
        </Text>
        <View className="gap-2">
          {ingredients.map((ingredient, index) => (
            <View key={`ingredient-${index}`} className="flex-row items-center gap-2">
              <TextInput
                className={`${inputClassName} min-w-0 flex-1`}
                placeholder={t('recipeForm.ingredientName')}
                placeholderTextColor="rgba(241, 245, 249, 0.4)"
                value={ingredient.name}
                onChangeText={(value) => handleIngredientChange(index, 'name', value)}
                testID={`recipe-form-ingredient-name-${index}`}
              />
              <TextInput
                className={`${inputClassName} w-20`}
                placeholder={t('recipeForm.qty')}
                placeholderTextColor="rgba(241, 245, 249, 0.4)"
                value={ingredient.quantity}
                onChangeText={(value) => handleIngredientChange(index, 'quantity', value)}
                keyboardType="decimal-pad"
                testID={`recipe-form-ingredient-quantity-${index}`}
              />
              <TextInput
                className={`${inputClassName} w-20`}
                placeholder={t('recipeForm.unit')}
                placeholderTextColor="rgba(241, 245, 249, 0.4)"
                value={ingredient.unit}
                onChangeText={(value) => handleIngredientChange(index, 'unit', value)}
                testID={`recipe-form-ingredient-unit-${index}`}
              />
              <Pressable
                accessibilityRole="button"
                className="h-9 w-9 items-center justify-center"
                onPress={() => handleRemoveIngredient(index)}
                testID={`recipe-form-remove-ingredient-${index}`}
              >
                <FontAwesome name="minus-circle" size={18} color="#F87171" />
              </Pressable>
            </View>
          ))}
        </View>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 self-start"
          onPress={handleAddIngredient}
          testID="recipe-form-add-ingredient-button"
        >
          <FontAwesome name="plus-circle" size={14} color="#818CF8" />
          <ButtonText className="ml-2 text-violet">{t('recipeForm.addIngredient')}</ButtonText>
        </Button>
      </Box>

      <Box>
        <Text className="mb-2 text-sm font-semibold text-ice">
          {t('recipeForm.instructions')}
        </Text>
        <TextInput
          className={`${inputClassName} min-h-[140px]`}
          placeholder={t('recipeForm.instructions')}
          placeholderTextColor="rgba(241, 245, 249, 0.4)"
          value={instructions}
          onChangeText={setInstructions}
          multiline
          textAlignVertical="top"
          testID="recipe-form-instructions-input"
        />
      </Box>

      <View className="flex-row justify-end gap-2 pb-4 pt-2">
        <Button variant="ghost" onPress={onCancel} disabled={isLoading} testID="recipe-form-cancel-button">
          <ButtonText>{t('common.cancel')}</ButtonText>
        </Button>
        <Button
          className="bg-primary"
          onPress={handleSubmit}
          disabled={!name.trim() || isLoading}
          testID="recipe-form-submit-button"
        >
          {isLoading ? <ButtonSpinner color="#F1F5F9" /> : null}
          <ButtonText className="text-ice">{submitLabel}</ButtonText>
        </Button>
      </View>
    </Box>
  );
}
