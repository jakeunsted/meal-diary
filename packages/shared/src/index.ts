export type {
  EntitlementFeature,
  SubscriptionPlan,
  SubscriptionStatus,
} from './entitlements.ts';

export { FEATURE_FLAGS } from './featureFlags.ts';
export type { FeatureFlagKey } from './featureFlags.ts';

export { toLogAttributes } from './logAttributes.ts';

export type {
  LegalPage,
  LegalSection,
  PrivacyPage,
  SupportFaq,
  SupportPage,
} from './legalContent.ts';

export {
  OPERATOR_NAME,
  SUPPORT_EMAIL,
  TRADING_NAME,
  privacyPage,
  supportPage,
  termsPage,
} from './legalContent.ts';

export {
  DEFAULT_SHOPPING_CATEGORY,
  SHOPPING_CATEGORIES,
  SHOPPING_CATEGORY_LABEL_KEYS,
  SHOPPING_LIST_TABS,
  applyCategoryFlatOrder,
  buildShoppingListReorderPayload,
  categorizeShoppingItemName,
  groupShoppingListItemsByCategory,
  isShoppingCategory,
  isShoppingListTab,
  moveShoppingListItemToCategory,
  moveShoppingListItemWithinCategory,
  normalizeShoppingItemName,
  sortShoppingListItemsForDisplay,
} from './shoppingList/index.ts';

export type {
  ShoppingCategory,
  ShoppingListItemLike,
  ShoppingListReorderChange,
  ShoppingListTab,
} from './shoppingList/index.ts';
