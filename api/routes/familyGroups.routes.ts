import express from 'express';
import * as familyGroupController from '../controllers/family-group/familyGroup.controller.ts';

const router = express.Router();

// POST create family group
router.post('/', async (req, res, next) => {
  try {
    await familyGroupController.createFamilyGroup(req, res);
  } catch (error) {
    next(error);
  }
});

// GET get family group by ID
router.get('/:id', async (req, res, next) => {
  try {
    await familyGroupController.getFamilyGroupById(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
