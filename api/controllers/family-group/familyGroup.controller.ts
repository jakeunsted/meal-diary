import type { Request, Response } from 'express';
import { FamilyGroup, User, Subscription } from '../../db/models/associations.ts';
import ShoppingList from '../../db/models/ShoppingList.model.ts';
import { fourLetterWords } from '../../constants/four-letter-words.ts';
import { createNewWeeklyMeals } from '../../services/mealDiary.service.ts';
import * as FamilyGroupService from '../../services/familyGroup.service.ts';
import { trackEvent, getDistinctId } from '../../utils/posthog.ts';

// Map family lifecycle service errors onto HTTP statuses
const familyLifecycleErrorStatus = (message: string): number => {
  if (message.includes('not found')) return 404;
  if (message.includes('cannot leave')) return 409;
  if (message.includes('Only the family owner')) return 403;
  if (message.includes('must be a member') || message.includes('already own')) return 400;
  return 500;
};

// Generate a random identifier (three 4-letter words separated by hyphens)
const generateRandomIdentifier = (): string => {
  const getRandomWord = () => fourLetterWords[Math.floor(Math.random() * fourLetterWords.length)];
  return `${getRandomWord()}-${getRandomWord()}-${getRandomWord()}`;
};

export const createFamilyGroup = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    // Identity comes from the authenticated token, never the request body
    const created_by = (req.user as User | undefined)?.dataValues.id;

    if (!created_by) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Generate a unique random identifier
    let random_identifier = generateRandomIdentifier();
    let isUnique = false;
    
    while (!isUnique) {
      const existing = await FamilyGroup.findOne({ where: { random_identifier } });
      if (!existing) {
        isUnique = true;
      } else {
        random_identifier = generateRandomIdentifier();
      }
    }

    const familyGroup = await FamilyGroup.create({
      name,
      created_by,
      random_identifier
    });

    // if user does not have a family group, add them to this new family group
    const user = await User.findByPk(created_by);
    if (!user?.dataValues.family_group_id) {
      await User.update({ family_group_id: familyGroup.dataValues.id }, { where: { id: created_by } });
    }

    await Subscription.create({ family_group_id: Number(familyGroup.dataValues.id) });

    await ShoppingList.create({ family_group_id: Number(familyGroup.dataValues.id) });

    // Create initial meal diary for the current week
    const monday = new Date();
    monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1);
    monday.setHours(0, 0, 0, 0);
    await createNewWeeklyMeals(Number(familyGroup.dataValues.id), monday);

    // Track family group creation
    await trackEvent(created_by.toString(), 'family_group_created', {
      family_group_id: familyGroup.dataValues.id,
    });

    return res.status(201).json(familyGroup);
  } catch (error) {
    console.error('Error creating family group:', error);
    return res.status(500).json({ message: 'Failed to create family group' });
  }
};

export const joinFamilyGroup = async (req: Request, res: Response) => {
  try {
    const { random_identifier } = req.body;
    // Identity comes from the authenticated token, never the request body
    const user_id = (req.user as User | undefined)?.dataValues.id;

    if (!user_id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!random_identifier) {
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'family_group_join_failure', {
        reason: 'missing_fields',
      });
      return res.status(412).json({ message: 'Random identifier is required' });
    }

    const familyGroup = await FamilyGroup.findOne({
      where: { random_identifier }
    });

    if (!familyGroup) {
      await trackEvent(user_id.toString(), 'family_group_join_failure', {
        reason: 'not_found',
      });
      return res.status(404).json({ message: 'Family group not found' });
    }

    await User.update({ family_group_id: familyGroup.dataValues.id }, { where: { id: user_id } });

    // Track successful family group join
    await trackEvent(user_id.toString(), 'family_group_join_success', {
      family_group_id: familyGroup.dataValues.id,
    });

    return res.status(200).json({ message: 'Successfully joined family group' });
  } catch (error) {
    console.error('Error joining family group:', error);
    return res.status(500).json({ message: 'Failed to join family group' });
  }
};

export const getFamilyGroupById = async (req: Request, res: Response) => {
  try {
    const familyGroupId = parseInt(req.params.family_group_id ?? req.params.id);
    if (isNaN(familyGroupId)) {
      return res.status(400).json({ message: 'Invalid family group ID' });
    }

    if ((req.user as User | undefined)?.dataValues.family_group_id !== familyGroupId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const familyGroup = await FamilyGroup.findByPk(familyGroupId);
    if (!familyGroup) {
      return res.status(404).json({ message: 'Family group not found' });
    }

    return res.status(200).json(familyGroup);
  } catch (error) {
    console.error('Error getting family group:', error);
    return res.status(500).json({ message: 'Failed to get family group' });
  }
};

export const leaveFamilyGroup = async (req: Request, res: Response) => {
  try {
    const familyGroupId = parseInt(req.params.family_group_id ?? req.params.id);
    const userId = (req.user as User).dataValues.id;

    try {
      await FamilyGroupService.leaveFamilyGroup(familyGroupId, userId);
    } catch (serviceError) {
      const message = serviceError instanceof Error ? serviceError.message : 'Failed to leave family group';
      const status = familyLifecycleErrorStatus(message);
      if (status !== 500) {
        return res.status(status).json({ message });
      }
      throw serviceError;
    }

    await trackEvent(userId.toString(), 'family_group_left', {
      family_group_id: familyGroupId,
    });

    return res.status(200).json({ message: 'You have left the family group' });
  } catch (error) {
    console.error('Error leaving family group:', error);
    return res.status(500).json({ message: 'Failed to leave family group' });
  }
};

export const transferFamilyGroupOwnership = async (req: Request, res: Response) => {
  try {
    const familyGroupId = parseInt(req.params.family_group_id ?? req.params.id);
    const userId = (req.user as User).dataValues.id;
    const newOwnerId = parseInt(req.body?.new_owner_id);

    if (isNaN(newOwnerId)) {
      return res.status(400).json({ message: 'new_owner_id is required' });
    }

    try {
      await FamilyGroupService.transferFamilyGroupOwnership(familyGroupId, userId, newOwnerId);
    } catch (serviceError) {
      const message = serviceError instanceof Error ? serviceError.message : 'Failed to transfer ownership';
      const status = familyLifecycleErrorStatus(message);
      if (status !== 500) {
        return res.status(status).json({ message });
      }
      throw serviceError;
    }

    await trackEvent(userId.toString(), 'family_group_ownership_transferred', {
      family_group_id: familyGroupId,
      new_owner_id: newOwnerId,
    });

    return res.status(200).json({ message: 'Ownership transferred' });
  } catch (error) {
    console.error('Error transferring family group ownership:', error);
    return res.status(500).json({ message: 'Failed to transfer ownership' });
  }
};

export const deleteFamilyGroup = async (req: Request, res: Response) => {
  try {
    const familyGroupId = parseInt(req.params.family_group_id ?? req.params.id);
    const userId = (req.user as User).dataValues.id;

    try {
      await FamilyGroupService.deleteFamilyGroup(familyGroupId, userId);
    } catch (serviceError) {
      const message = serviceError instanceof Error ? serviceError.message : 'Failed to delete family group';
      const status = familyLifecycleErrorStatus(message);
      if (status !== 500) {
        return res.status(status).json({ message });
      }
      throw serviceError;
    }

    await trackEvent(userId.toString(), 'family_group_deleted', {
      family_group_id: familyGroupId,
    });

    return res.status(200).json({ message: 'Family group and all of its data have been deleted' });
  } catch (error) {
    console.error('Error deleting family group:', error);
    return res.status(500).json({ message: 'Failed to delete family group' });
  }
};

export const getFamilyGroupMembers = async (req: Request, res: Response) => {
  try {
    const familyGroupId = parseInt(req.params.family_group_id ?? req.params.id);
    if (isNaN(familyGroupId)) {
      return res.status(400).json({ message: 'Invalid family group ID' });
    }

    if ((req.user as User | undefined)?.dataValues.family_group_id !== familyGroupId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const familyGroup = await FamilyGroup.findByPk(familyGroupId);
    if (!familyGroup) {
      return res.status(404).json({ message: 'Family group not found' });
    }

    const members = await User.findAll({
      where: { family_group_id: familyGroupId },
      attributes: ['id', 'username', 'email', 'avatar_url', 'created_at', 'updated_at']
    });

    return res.status(200).json(members);
  } catch (error) {
    console.error('Error getting family group members:', error);
    return res.status(500).json({ message: 'Failed to get family group members' });
  }
};
