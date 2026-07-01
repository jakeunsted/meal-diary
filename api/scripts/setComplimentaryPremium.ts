import dotenv from 'dotenv';
import { initializeDatabase } from '../db/db.ts';
import { getOrCreateSubscription } from '../services/entitlements.service.ts';

dotenv.config();

/**
 * Mark a family group as complimentary premium (no payment required).
 * Usage: COMPLIMENTARY_FAMILY_GROUP_ID=1 npm run set-complimentary
 */
(async () => {
  const familyGroupId = Number(process.env.COMPLIMENTARY_FAMILY_GROUP_ID);

  if (!familyGroupId || Number.isNaN(familyGroupId)) {
    console.error('Set COMPLIMENTARY_FAMILY_GROUP_ID to your family group id');
    process.exit(1);
  }

  try {
    const dbInitialized = await initializeDatabase(false);
    if (!dbInitialized) {
      console.error('Failed to initialize database');
      process.exit(1);
    }

    const subscription = await getOrCreateSubscription(familyGroupId);
    await subscription.update({
      is_complimentary: true,
      complimentary_reason: 'developer',
    });

    console.log(`Family group ${familyGroupId} is now complimentary premium.`);
    process.exit(0);
  } catch (error) {
    console.error('Error setting complimentary premium:', error);
    process.exit(1);
  }
})();
