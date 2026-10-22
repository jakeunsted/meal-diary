import type { Request, Response } from 'express';
import type User from '../../db/models/User.model.ts';
import { handleEntitlementError } from '../../middleware/entitlement.middleware.ts';
import {
  AlexaFamilyRequiredError,
  AlexaOAuthRequestError,
  AlexaTokenError,
  createAlexaAuthorization,
  disconnectAlexaLink,
  getAlexaLinkStatus,
  grantAlexaTokens,
} from '../../services/alexaOAuth.service.ts';

const readUser = (req: Request): User | undefined => req.user as User | undefined;

export const authorizeAlexaLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = readUser(req);
    if (!user) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const result = await createAlexaAuthorization(user, req.body);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AlexaOAuthRequestError) {
      res.status(400).json({ code: error.code });
      return;
    }
    if (error instanceof AlexaFamilyRequiredError) {
      res.status(403).json({ code: error.code });
      return;
    }
    if (handleEntitlementError(error, res)) {
      return;
    }
    console.error('Error authorizing Alexa link:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const exchangeAlexaToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const tokens = await grantAlexaTokens(req.body);
    res.status(200).json(tokens);
  } catch (error) {
    if (error instanceof AlexaTokenError) {
      res.status(error.status).json({ error: error.oauthError });
      return;
    }
    console.error('Error exchanging Alexa token:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAlexaLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = readUser(req);
    if (!user) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const status = await getAlexaLinkStatus(user.dataValues.id);
    res.status(200).json(status);
  } catch (error) {
    console.error('Error reading Alexa link:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteAlexaLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = readUser(req);
    if (!user) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    await disconnectAlexaLink(user.dataValues.id);
    res.status(204).end();
  } catch (error) {
    console.error('Error disconnecting Alexa link:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
