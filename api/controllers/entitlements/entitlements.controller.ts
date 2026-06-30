import type { Request, Response } from 'express';
import { User } from '../../db/models/associations.ts';
import * as EntitlementsService from '../../services/entitlements.service.ts';
import { handleEntitlementError } from '../../middleware/entitlement.middleware.ts';

export const getFamilyEntitlements = async (req: Request, res: Response) => {
  try {
    const familyGroupId = parseInt(req.params.family_group_id ?? req.params.id ?? '', 10);
    const user = req.user as User | undefined;

    if (Number.isNaN(familyGroupId)) {
      return res.status(400).json({ message: 'Invalid family group ID' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const entitlements = await EntitlementsService.resolveEntitlements(
      familyGroupId,
      user.dataValues.id
    );

    return res.status(200).json(entitlements);
  } catch (error) {
    console.error('Error getting family entitlements:', error);
    return res.status(500).json({ message: 'Failed to get entitlements' });
  }
};

export const dismissEntitlementPrompt = async (req: Request, res: Response) => {
  try {
    const familyGroupId = parseInt(req.params.family_group_id ?? req.params.id ?? '', 10);
    const user = req.user as User | undefined;
    const { prompt } = req.body as { prompt?: string };

    if (Number.isNaN(familyGroupId)) {
      return res.status(400).json({ message: 'Invalid family group ID' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (prompt !== 'trial_expired') {
      return res.status(400).json({ message: 'Invalid prompt type' });
    }

    await EntitlementsService.dismissEntitlementPrompt(
      familyGroupId,
      user.dataValues.id,
      prompt
    );

    const entitlements = await EntitlementsService.resolveEntitlements(
      familyGroupId,
      user.dataValues.id
    );

    return res.status(200).json(entitlements);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Only the family owner')) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
    }

    console.error('Error dismissing entitlement prompt:', error);
    return res.status(500).json({ message: 'Failed to dismiss prompt' });
  }
};
