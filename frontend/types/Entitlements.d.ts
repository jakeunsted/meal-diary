import type {
  EntitlementFeature,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@meal-diary/shared';

export type { EntitlementFeature, SubscriptionPlan, SubscriptionStatus };

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
    storePlatform: 'web' | 'ios' | 'android' | null;
  };
}
