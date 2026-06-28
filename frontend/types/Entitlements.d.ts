export type EntitlementFeature =
  | 'family_members'
  | 'weeks_ahead'
  | 'edit_past_weeks'
  | 'recipes'
  | 'recipe_to_shopping_list';

export type SubscriptionPlan = 'free' | 'premium';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'expired'
  | 'payment_failed';

export interface PlanLimits {
  maxFamilyMembers: number;
  maxRecipes: number;
  maxWeeksAhead: number;
  canEditPastWeeks: boolean;
  canAddRecipeToShoppingList: boolean;
}

export interface ResolvedEntitlements {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isComplimentary: boolean;
  features: Record<EntitlementFeature, boolean>;
  limits: PlanLimits;
  usage: {
    familyMemberCount: number;
    recipeCount: number;
  };
  trial?: {
    endsAt: string;
    daysRemaining: number;
  };
  prompts: {
    trialExpired: boolean;
    paymentFailed: boolean;
    paymentFailedUntil: string | null;
  };
  billing: {
    isOwner: boolean;
    ownerDisplayName: string | null;
    trialAvailable: boolean;
  };
}
