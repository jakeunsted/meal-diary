import type { Request, Response } from 'express';
import { User } from '../../db/models/associations.ts';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';

// Create a new user
export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, first_name, last_name, family_group_id } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [
          { username },
          { email: email.toLowerCase() }
        ] 
      } 
    });
    
    if (existingUser) {
      return res.status(409).json({ message: 'User with this username or email already exists' });
    }
    
    // Create new user
    const newUser = await User.create({
      username,
      email: email.toLowerCase(),
      password_hash: hashedPassword,
      first_name,
      last_name,
      family_group_id
    });
    
    // Remove password hash from response
    const userResponse = newUser.toJSON();
    delete (userResponse as any).password_hash;
    
    return res.status(201).json(userResponse);
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ message: 'Failed to create user' });
  }
};

// Get all users
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password_hash'] }
    });
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
    
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Failed to fetch user' });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, email, first_name, last_name, family_group_id } = req.body;
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if username or email is being changed and already exists
    if (username && username !== user.dataValues.username) {
      const existingUsername = await User.findOne({ where: { username } });
      if (existingUsername) {
        return res.status(409).json({ message: 'Username already taken' });
      }
    }
    
    if (email && email !== user.dataValues.email) {
      const existingEmail = await User.findOne({ where: { email: email.toLowerCase() } });
      if (existingEmail) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }
    
    // Update user
    await user.update({
      username,
      email: email.toLowerCase(),
      first_name,
      last_name,
      family_group_id
    });
    
    // Get updated user without password hash
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] }
    });
    
    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Failed to update user' });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await user.destroy();
    
    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Failed to delete user' });
  }
};
