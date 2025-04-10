import type { Request, Response } from 'express';
import { FamilyGroup } from '../../db/models/associations.ts';
import { createBaseShoppingList } from '../../services/shoppingList.service.ts';

export const createFamilyGroup = async (req: Request, res: Response) => {
  try {
    const { name, created_by } = req.body;

    const familyGroup = await FamilyGroup.create({
      name,
      created_by
    });

    await createBaseShoppingList(familyGroup.dataValues.id);

    return res.status(201).json(familyGroup);
  } catch (error) {
    console.error('Error creating family group:', error);
    return res.status(500).json({ message: 'Failed to create family group' });
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
