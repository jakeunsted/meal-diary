import type { Request, Response } from 'express';
import { trackEvent, getDistinctId } from '../../utils/posthog.ts';
import * as UserService from '../../services/user.service.ts';

// Create a new user
export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, first_name, last_name, family_group_code, family_group_id } = req.body;

    try {
      const { user, familyGroupId } = await UserService.createUser({
        username,
        email,
        password,
        first_name,
        last_name,
        family_group_code,
        family_group_id
      });

      // Track user registration
      await trackEvent(user.id.toString(), 'user_registered', {
        has_family_group_code: !!family_group_code,
        family_group_id: familyGroupId,
      });

      return res.status(201).json(user);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to create user';
      
      // Determine failure reason and status code
      let reason = 'server_error';
      let statusCode = 500;

      if (errorMessage.includes('required')) {
        reason = 'missing_fields';
        statusCode = 400;
      } else if (errorMessage.includes('Family group not found')) {
        reason = 'family_group_not_found';
        statusCode = 404;
      } else if (errorMessage.includes('already exists')) {
        reason = 'user_exists';
        statusCode = 409;
      }

      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'user_registration_failed', {
        reason,
      });

      return res.status(statusCode).json({ message: errorMessage });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    const distinctId = getDistinctId(req);
    await trackEvent(distinctId, 'user_registration_failed', {
      reason: 'server_error',
    });
    return res.status(500).json({ message: 'Failed to create user' });
  }
};

// Get all users
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await UserService.getAllUsers();
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    try {
      const user = await UserService.getUserById(userId);
      return res.status(200).json(user);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'User not found';
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }
      throw serviceError;
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Failed to fetch user' });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, email, first_name, last_name, family_group_id, avatar_url } = req.body;

    try {
      const updatedUser = await UserService.updateUser(userId, {
        username,
        email,
        first_name,
        last_name,
        family_group_id,
        avatar_url
      });

      return res.status(200).json(updatedUser);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to update user';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }
      
      if (errorMessage.includes('already taken') || errorMessage.includes('already in use')) {
        return res.status(409).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Failed to update user' });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    try {
      await UserService.deleteUser(userId);
      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'User not found';
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }
      throw serviceError;
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Failed to delete user' });
  }
};
