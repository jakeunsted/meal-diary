import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User, { type UserAttributes } from '../../db/models/User.model.ts';
import RefreshToken from '../../db/models/RefreshToken.model.ts';
import { Op } from 'sequelize';
import crypto from 'crypto';

/**
 * Generate JWT tokens
 * @param {number} userId - The user id
 * @returns {Promise<{ accessToken: string, refreshToken: string }>} The generated tokens
 */
const generateTokens = async (userId: number) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  
  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT secrets not configured');
  }
  
  const accessToken = jwt.sign(
    { userId },
    accessSecret,
    { expiresIn: '15m' } // Short-lived access token
  );
  
  // Generate a unique identifier for the refresh token
  const tokenId = crypto.randomUUID();
  
  const refreshToken = jwt.sign(
    { 
      userId,
      tokenId // Add unique identifier to prevent token collisions
    },
    refreshSecret,
    { expiresIn: '7d' } // 7-day refresh token
  );
  
  // Store refresh token in database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
  
  // Delete any existing refresh token for this user
  await RefreshToken.destroy({
    where: { user_id: userId }
  });
  
  // Create new refresh token
  await RefreshToken.create({
    token: refreshToken,
    user_id: userId,
    expires_at: expiresAt,
    is_revoked: false
  });
  
  return { accessToken, refreshToken };
};

/**
 * Login controller
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }
    
    // Find user by email
    const user = await User.findOne({ where: { email } }) as User & UserAttributes;
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);
    
    // Return user data and tokens
    res.status(200).json({
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

/**
 * Refresh token controller
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({ message: 'Refresh token is required' });
      return;
    }
    
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret) {
      res.status(500).json({ message: 'Server configuration error' });
      return;
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, refreshSecret) as { userId: number };
    
    // Check if token exists and is not revoked
    const storedToken = await RefreshToken.findOne({
      where: {
        token: refreshToken,
        is_revoked: false,
        expires_at: {
          [Op.gt]: new Date() // Token hasn't expired
        }
      }
    });
    
    if (!storedToken) {
      res.status(403).json({ message: 'Invalid or expired refresh token' });
      return;
    }
    
    // Find user
    const user = await User.findByPk(decoded.userId) as User & UserAttributes;
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }
    
    // Generate new tokens (this will automatically delete the old one)
    const tokens = await generateTokens(user.id);
    
    res.status(200).json({
      ...tokens,
      user
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ message: 'Invalid or expired refresh token' });
      return;
    }
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Server error during token refresh' });
  }
};

/**
 * Logout controller
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.body.refreshToken;
    
    if (refreshToken) {
      // Delete the refresh token
      await RefreshToken.destroy({
        where: { token: refreshToken }
      });
    }
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

/**
 * Validate token controller
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const validateToken = async (req: Request, res: Response): Promise<void> => {
  try {
    // The authenticateToken middleware has already verified the token
    // and attached the user to the request
    const user = req.user as User & UserAttributes;

    console.log('user', user);

    res.status(200).json({
      valid: true,
      user
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({
      valid: false,
      message: 'Invalid token'
    });
  }
};
