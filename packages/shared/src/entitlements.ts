export type EntitlementFeature =
  | 'family_members'
  | 'weeks_ahead'
  | 'edit_past_weeks'
  | 'recipes'
  | 'recipe_to_shopping_list'
  | 'custom_meal_slots'
  | 'custom_recipe_categories';

export type SubscriptionPlan = 'free' | 'premium';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'expired'
  | 'payment_failed';
