import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { type UserAttributes } from '../db/models/User.model.ts';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // if NODE_ENV is test, skip authentication
  // if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
  //   next();
  //   return;
  // }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const jwtSecret = process.env.JWT_ACCESS_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: number };
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Only allow the authenticated user to act on their own user id.
 * Must be mounted after authenticateToken on routes with an :id param.
 */
export const requireSelf = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const targetId = parseInt(req.params.id);
  const user = req.user as User | undefined;

  if (!user || isNaN(targetId) || user.dataValues.id !== targetId) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }

  next();
};

/**
 * Only allow access to resources in the authenticated user's own family
 * group. Must be mounted after authenticateToken on routes with a
 * :family_group_id param.
 */
export const requireFamilyMember = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const familyGroupId = parseInt(req.params.family_group_id);
  const user = req.user as User | undefined;

  if (isNaN(familyGroupId)) {
    res.status(400).json({ message: 'Invalid family group ID' });
    return;
  }

  if (!user || user.dataValues.family_group_id !== familyGroupId) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }

  next();
};
