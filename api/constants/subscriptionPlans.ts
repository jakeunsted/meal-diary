export const TRIAL_DAYS = 7;

export const PAYMENT_FAILED_BANNER_DAYS = 3;

export interface PlanLimits {
  maxFamilyMembers: number;
  maxRecipes: number;
  maxWeeksAhead: number;
  canEditPastWeeks: boolean;
  canAddRecipeToShoppingList: boolean;
}

export const PLANS = {
  free: {
    maxFamilyMembers: 2,
    maxRecipes: 10,
    maxWeeksAhead: 1,
    canEditPastWeeks: false,
    canAddRecipeToShoppingList: false,
  },
  premium: {
    maxFamilyMembers: 8,
    maxRecipes: Number.POSITIVE_INFINITY,
    maxWeeksAhead: Number.POSITIVE_INFINITY,
    canEditPastWeeks: true,
    canAddRecipeToShoppingList: true,
  },
} as const satisfies Record<'free' | 'premium', PlanLimits>;
