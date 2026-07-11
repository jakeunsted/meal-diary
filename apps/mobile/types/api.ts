import type {
  EntitlementFeature,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@meal-diary/shared';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  family_group_id?: number;
  avatar_url?: string;
  has_password?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FamilyMember {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DisplayMember {
  id: number;
  name: string;
  avatar_url?: string;
}

export interface FamilyGroup {
  id: number;
  name: string;
  random_identifier: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

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

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  entitlements?: ResolvedEntitlements;
}
