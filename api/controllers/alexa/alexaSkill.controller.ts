import type { Request, Response } from 'express';
import { verifyAlexaSkillRequest } from '../../services/alexaRequestVerification.service.ts';
import { fulfillAlexaSkill } from '../../services/alexaSkill.service.ts';

export const handleAlexaSkill = async (req: Request, res: Response): Promise<void> => {
  try {
    const skipVerification =
      process.env.NODE_ENV === 'development' && !process.env.ALEXA_SKILL_ID;

    if (!skipVerification) {
      if (!process.env.ALEXA_SKILL_ID) {
        res.status(400).end();
        return;
      }
      const valid = await verifyAlexaSkillRequest(req);
      if (!valid) {
        res.status(400).end();
        return;
      }
    }

    const result = await fulfillAlexaSkill(req.body);
    if (result.httpStatus === 404 || result.body === null) {
      res.status(404).end();
      return;
    }
    res.status(result.httpStatus).json(result.body);
  } catch (error) {
    console.error('Error fulfilling Alexa skill:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
