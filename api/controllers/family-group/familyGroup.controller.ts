import type { Request, Response } from 'express';
import { FamilyGroup, User } from '../../db/models/associations.ts';
import ShoppingList from '../../db/models/ShoppingList.model.ts';
import { fourLetterWords } from '../../constants/four-letter-words.ts';
import { createNewWeeklyMeals } from '../../services/mealDiary.service.ts';
import { trackEvent, getDistinctId } from '../../utils/posthog.ts';

// Generate a random identifier (three 4-letter words separated by hyphens)
const generateRandomIdentifier = (): string => {
  const getRandomWord = () => fourLetterWords[Math.floor(Math.random() * fourLetterWords.length)];
  return `${getRandomWord()}-${getRandomWord()}-${getRandomWord()}`;
};

export const createFamilyGroup = async (req: Request, res: Response) => {
  try {
    const { name, created_by } = req.body;

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
    const { random_identifier, user_id } = req.body;

    if (!random_identifier || !user_id) {
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'family_group_join_failure', {
        reason: 'missing_fields',
      });
      return res.status(412).json({ message: 'Random identifier and user id are required' });
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
    const { id } = req.params;

    const familyGroup = await FamilyGroup.findByPk(id);

    return res.status(200).json(familyGroup);
  } catch (error) {
    console.error('Error getting family group:', error);
    return res.status(500).json({ message: 'Failed to get family group' });
  }
};

export const getFamilyGroupMembers = async (req: Request, res: Response) => {
  try {
    const familyGroupId = parseInt(req.params.id);
    if (isNaN(familyGroupId)) {
      return res.status(400).json({ message: 'Invalid family group ID' });
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
