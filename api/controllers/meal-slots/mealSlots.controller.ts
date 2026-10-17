import type { Request, Response } from 'express';
import type { MealSlotInput } from '@meal-diary/shared';
import { User } from '../../db/models/associations.ts';
import * as EntitlementsService from '../../services/entitlements.service.ts';
import { handleEntitlementError } from '../../middleware/entitlement.middleware.ts';
import {
  MealSlotsConfirmationRequiredError,
  MealSlotsValidationError,
  getActiveMealSlots,
  replaceMealSlots,
} from '../../services/mealSlots.service.ts';
import { emitFamilyEvent } from '../../services/sse.service.ts';
import { trackEvent, sanitizeErrorForAnalytics } from '../../utils/posthog.ts';
import { emitLog } from '../../utils/otelLogs.ts';
import { routeParamInt } from '../../utils/routeParam.ts';

export const getMealSlots = async (req: Request, res: Response) => {
  try {
    const familyGroupId = routeParamInt(req.params.family_group_id);

    if (!familyGroupId || Number.isNaN(familyGroupId)) {
      return res.status(400).json({ message: 'Invalid family group id' });
    }

    const slots = await getActiveMealSlots(familyGroupId);
    return res.status(200).json({ slots });
  } catch (error) {
    console.error('Error getting meal slots:', error);
    return res.status(500).json({ message: 'Failed to get meal slots' });
  }
};

export const updateMealSlots = async (req: Request, res: Response) => {
  const user = req.user as User;
  const familyGroupId = routeParamInt(req.params.family_group_id);

  try {
    if (!familyGroupId || Number.isNaN(familyGroupId)) {
      return res.status(400).json({ message: 'Invalid family group id' });
    }

    try {
      await EntitlementsService.assertFeature(familyGroupId, user.dataValues.id, 'custom_meal_slots');
    } catch (error) {
      if (handleEntitlementError(error, res)) {
        return;
      }
      throw error;
    }

    const { slots, today, confirm } = req.body as {
      slots?: MealSlotInput[];
      today?: string;
      confirm?: boolean;
    };

    if (!Array.isArray(slots) || typeof today !== 'string') {
      return res.status(400).json({ message: 'slots and today are required' });
    }

    const result = await replaceMealSlots(
      familyGroupId,
      slots,
      today,
      Boolean(confirm)
    );

    emitFamilyEvent(familyGroupId, 'meal-slots-updated', {
      slots: result.slots,
      today,
    });

    if (user) {
      await trackEvent(user.dataValues.id.toString(), 'meal_slots_updated', {
        family_group_id: familyGroupId,
        slot_count: result.slots.length,
      });
    }

    return res.status(200).json({ slots: result.slots });
  } catch (error) {
    if (error instanceof MealSlotsConfirmationRequiredError) {
      return res.status(409).json({
        code: error.code,
        removed: error.removed,
      });
    }

    if (error instanceof MealSlotsValidationError) {
      return res.status(400).json({
        code: error.code,
        message: error.message,
      });
    }

    const sanitized = sanitizeErrorForAnalytics(error);
    emitLog({
      severity: 'error',
      body: 'meal_slots_update_failed',
      attributes: {
        category: 'meal_slots',
        family_group_id: familyGroupId,
        error_type: sanitized.error_type,
        error_message: sanitized.error_message,
      },
    });

    console.error('Error updating meal slots:', error);
    return res.status(500).json({ message: 'Failed to update meal slots' });
  }
};
