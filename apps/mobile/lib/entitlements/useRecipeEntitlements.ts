import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ResolvedEntitlements } from '@/types/api';

export function useRecipeEntitlements(entitlements: ResolvedEntitlements | undefined) {
  const { t } = useTranslation();

  const canCreateRecipe = entitlements?.features.recipes ?? false;
  const canAddToShoppingList = entitlements?.features.recipe_to_shopping_list ?? false;
  const recipeCount = entitlements?.usage.recipeCount ?? 0;
  const maxRecipes = entitlements?.limits.maxRecipes;
  const billing = entitlements?.billing;

  const recipesRemaining = useMemo(() => {
    if (maxRecipes === undefined || !Number.isFinite(maxRecipes)) {
      return null;
    }

    return Math.max(0, maxRecipes - recipeCount);
  }, [maxRecipes, recipeCount]);

  const recipeUsageLabel = useMemo(() => {
    if (maxRecipes === undefined) {
      return null;
    }

    if (!Number.isFinite(maxRecipes)) {
      return t('recipesPage.usageUnlimited', { count: recipeCount });
    }

    return t('recipesPage.usageLabel', { count: recipeCount, max: maxRecipes });
  }, [maxRecipes, recipeCount, t]);

  const recipeLimitHelperText = useMemo(() => {
    if (!billing) {
      return t('recipesPage.askOwnerToUpgradeGeneric');
    }

    if (billing.isOwner) {
      return t('recipesPage.upgradeLink');
    }

    if (billing.ownerDisplayName) {
      return t('recipesPage.askOwnerToUpgrade', { name: billing.ownerDisplayName });
    }

    return t('recipesPage.askOwnerToUpgradeGeneric');
  }, [billing, t]);

  return {
    canCreateRecipe,
    canAddToShoppingList,
    recipeCount,
    maxRecipes,
    recipesRemaining,
    recipeUsageLabel,
    recipeLimitHelperText,
    billing,
  };
}
