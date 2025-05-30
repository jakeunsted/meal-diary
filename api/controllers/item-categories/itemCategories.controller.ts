import type { Request, Response } from 'express';
import ItemCategory from '../../db/models/ItemCategory.model.ts';

export const getAllItemCategories = async (req: Request, res: Response) => {
  try {
    const categories = await ItemCategory.findAll();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching item categories', error });
  }
};

export const getItemCategoryById = async (req: Request, res: Response) => {
  try {
    const category = await ItemCategory.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Item category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching item category', error });
  }
};

export const createItemCategory = async (req: Request, res: Response) => {
  try {
    const { name, icon } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const category = await ItemCategory.create({ name, icon });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error creating item category', error });
  }
};

export const updateItemCategory = async (req: Request, res: Response) => {
  try {
    const { name, icon } = req.body;
    const category = await ItemCategory.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Item category not found' });
    }
    await category.update({ name, icon });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error updating item category', error });
  }
};

export const deleteItemCategory = async (req: Request, res: Response) => {
  try {
    const category = await ItemCategory.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Item category not found' });
    }
    await category.destroy();
    res.json({ message: 'Item category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting item category', error });
  }
}; 