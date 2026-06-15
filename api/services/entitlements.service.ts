import type { EntitlementFeature, SubscriptionPlan, SubscriptionStatus } from '../constants/entitlementFeatures.ts';
import { PAYMENT_FAILED_BANNER_DAYS, PLANS } from '../constants/subscriptionPlans.ts';
import type { PlanLimits } from '../constants/subscriptionPlans.ts';
import {
  FamilyGroup,
  Recipe,
  Subscription,
  User,
} from '../db/models/associations.ts';
import type { SubscriptionAttributes } from '../db/models/Subscription.model.ts';

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
  };
}

export class EntitlementRequiredError extends Error {
  readonly code = 'ENTITLEMENT_REQUIRED';

  constructor(
    readonly feature: EntitlementFeature,
    readonly plan: SubscriptionPlan
  ) {
    super('ENTITLEMENT_REQUIRED');
    this.name = 'EntitlementRequiredError';
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getCurrentIsoWeekMonday = (referenceDate: Date = new Date()): Date => {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeWeekStart = (weekStartDate: Date): Date => {
  const normalized = new Date(weekStartDate);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const isWeekAheadAllowed = (
  weekStartDate: Date,
  maxWeeksAhead: number,
  referenceDate: Date = new Date()
): boolean => {
  if (!Number.isFinite(maxWeeksAhead)) {
    return true;
  }

  const currentMonday = getCurrentIsoWeekMonday(referenceDate);
  const targetMonday = normalizeWeekStart(weekStartDate);
  const diffMs = targetMonday.getTime() - currentMonday.getTime();
  const diffWeeks = Math.round(diffMs / (7 * MS_PER_DAY));

  return diffWeeks <= maxWeeksAhead;
};

export const isPastWeekEditable = (
  weekStartDate: Date,
  canEditPastWeeks: boolean,
  referenceDate: Date = new Date()
): boolean => {
  if (canEditPastWeeks) {
    return true;
  }

  const currentMonday = getCurrentIsoWeekMonday(referenceDate);
  const targetMonday = normalizeWeekStart(weekStartDate);

  return targetMonday.getTime() >= currentMonday.getTime();
};

const isPremiumSubscription = (subscription: SubscriptionAttributes): boolean => {
  if (subscription.is_complimentary) {
    return true;
  }

  return (
    subscription.plan === 'premium' &&
    (subscription.status === 'active' || subscription.status === 'trialing')
  );
};

const resolveLimits = (subscription: SubscriptionAttributes): PlanLimits => {
  if (isPremiumSubscription(subscription)) {
    return PLANS.premium;
  }

  return PLANS.free;
};

const resolveFeatures = (
  limits: PlanLimits,
  usage: { familyMemberCount: number; recipeCount: number }
): Record<EntitlementFeature, boolean> => ({
  family_members:
    !Number.isFinite(limits.maxFamilyMembers) ||
    usage.familyMemberCount < limits.maxFamilyMembers,
  weeks_ahead:
    !Number.isFinite(limits.maxWeeksAhead) || limits.maxWeeksAhead > 0,
  edit_past_weeks: limits.canEditPastWeeks,
  recipes:
    !Number.isFinite(limits.maxRecipes) || usage.recipeCount < limits.maxRecipes,
  recipe_to_shopping_list: limits.canAddRecipeToShoppingList,
});

const getOwnerDisplayName = async (familyGroupId: number): Promise<string | null> => {
  const familyGroup = await FamilyGroup.findByPk(familyGroupId);
  if (!familyGroup) {
    return null;
  }

  const owner = await User.findByPk(familyGroup.dataValues.created_by);
  if (!owner) {
    return null;
  }

  const firstName = owner.dataValues.first_name?.trim();
  if (firstName) {
    return firstName;
  }

  return owner.dataValues.username;
};

const resolvePrompts = (
  subscription: SubscriptionAttributes,
  isOwner: boolean
): ResolvedEntitlements['prompts'] => {
  const now = Date.now();

  const paymentFailedUntil =
    subscription.payment_failed_at &&
    now - subscription.payment_failed_at.getTime() <= PAYMENT_FAILED_BANNER_DAYS * MS_PER_DAY
      ? new Date(
          subscription.payment_failed_at.getTime() + PAYMENT_FAILED_BANNER_DAYS * MS_PER_DAY
        ).toISOString()
      : null;

  const trialExpired =
    isOwner &&
    subscription.status === 'expired' &&
    subscription.trial_ends_at !== null &&
    subscription.trial_expired_prompt_seen_at === null;

  const paymentFailed =
    isOwner &&
    subscription.status === 'payment_failed' &&
    paymentFailedUntil !== null;

  return {
    trialExpired,
    paymentFailed,
    paymentFailedUntil,
  };
};

export const getOrCreateSubscription = async (
  familyGroupId: number
): Promise<Subscription> => {
  const [subscription] = await Subscription.findOrCreate({
    where: { family_group_id: familyGroupId },
    defaults: { family_group_id: familyGroupId },
  });

  return subscription;
};

export const resolveEntitlements = async (
  familyGroupId: number,
  requestingUserId: number
): Promise<ResolvedEntitlements> => {
  const subscriptionRecord = await getOrCreateSubscription(familyGroupId);
  const subscription = subscriptionRecord.dataValues as SubscriptionAttributes;

  const familyGroup = await FamilyGroup.findByPk(familyGroupId);
  const isOwner = familyGroup?.dataValues.created_by === requestingUserId;
  const ownerDisplayName = await getOwnerDisplayName(familyGroupId);

  const limits = resolveLimits(subscription);
  const effectivePlan: SubscriptionPlan = isPremiumSubscription(subscription) ? 'premium' : 'free';

  const [familyMemberCount, recipeCount] = await Promise.all([
    User.count({ where: { family_group_id: familyGroupId } }),
    Recipe.count({ where: { family_group_id: familyGroupId } }),
  ]);

  const entitlements: ResolvedEntitlements = {
    plan: effectivePlan,
    status: subscription.status,
    isComplimentary: subscription.is_complimentary,
    features: resolveFeatures(limits, { familyMemberCount, recipeCount }),
    limits,
    usage: {
      familyMemberCount,
      recipeCount,
    },
    prompts: resolvePrompts(subscription, isOwner),
    billing: {
      isOwner,
      ownerDisplayName,
    },
  };

  if (subscription.status === 'trialing' && subscription.trial_ends_at) {
    const daysRemaining = Math.max(
      0,
      Math.ceil((subscription.trial_ends_at.getTime() - Date.now()) / MS_PER_DAY)
    );
    entitlements.trial = {
      endsAt: subscription.trial_ends_at.toISOString(),
      daysRemaining,
    };
  }

  return entitlements;
};

export const assertCanAddFamilyMember = async (
  familyGroupId: number,
  requestingUserId: number
): Promise<ResolvedEntitlements> => {
  const entitlements = await resolveEntitlements(familyGroupId, requestingUserId);

  if (entitlements.usage.familyMemberCount >= entitlements.limits.maxFamilyMembers) {
    throw new EntitlementRequiredError('family_members', entitlements.plan);
  }

  return entitlements;
};

export const assertCanCreateRecipe = async (
  familyGroupId: number,
  requestingUserId: number
): Promise<ResolvedEntitlements> => {
  const entitlements = await resolveEntitlements(familyGroupId, requestingUserId);

  if (
    Number.isFinite(entitlements.limits.maxRecipes) &&
    entitlements.usage.recipeCount >= entitlements.limits.maxRecipes
  ) {
    throw new EntitlementRequiredError('recipes', entitlements.plan);
  }

  return entitlements;
};

export const assertCanUpdateMealWeek = async (
  familyGroupId: number,
  requestingUserId: number,
  weekStartDate: Date
): Promise<ResolvedEntitlements> => {
  const entitlements = await resolveEntitlements(familyGroupId, requestingUserId);

  if (!isPastWeekEditable(weekStartDate, entitlements.limits.canEditPastWeeks)) {
    throw new EntitlementRequiredError('edit_past_weeks', entitlements.plan);
  }

  if (!isWeekAheadAllowed(weekStartDate, entitlements.limits.maxWeeksAhead)) {
    throw new EntitlementRequiredError('weeks_ahead', entitlements.plan);
  }

  return entitlements;
};

export const assertFeature = async (
  familyGroupId: number,
  requestingUserId: number,
  feature: EntitlementFeature
): Promise<ResolvedEntitlements> => {
  const entitlements = await resolveEntitlements(familyGroupId, requestingUserId);

  if (!entitlements.features[feature]) {
    throw new EntitlementRequiredError(feature, entitlements.plan);
  }

  return entitlements;
};

export const dismissEntitlementPrompt = async (
  familyGroupId: number,
  requestingUserId: number,
  prompt: 'trial_expired'
): Promise<void> => {
  const familyGroup = await FamilyGroup.findByPk(familyGroupId);
  if (!familyGroup) {
    throw new Error('Family group not found');
  }

  if (familyGroup.dataValues.created_by !== requestingUserId) {
    throw new Error('Only the family owner can dismiss subscription prompts');
  }

  const subscription = await getOrCreateSubscription(familyGroupId);

  if (prompt === 'trial_expired') {
    await subscription.update({ trial_expired_prompt_seen_at: new Date() });
  }
};
