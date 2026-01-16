import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import User, { type UserAttributes } from '../db/models/User.model.ts';
import FamilyGroup from '../db/models/FamilyGroup.model.ts';

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  family_group_id?: number;
  family_group_code?: string;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  family_group_id?: number;
  avatar_url?: string;
}

/**
 * Resolve family group ID from code if provided
 * @param {string} familyGroupCode - Family group code
 * @returns {Promise<number | undefined>} Family group ID or undefined
 * @throws {Error} If family group not found
 */
const resolveFamilyGroupId = async (familyGroupCode?: string): Promise<number | undefined> => {
  if (!familyGroupCode) {
    return undefined;
  }

  const familyGroup = await FamilyGroup.findOne({ where: { random_identifier: familyGroupCode } });
  if (!familyGroup) {
    throw new Error('Family group not found');
  }

  return familyGroup.get('id') as number;
};

/**
 * Check if user exists by username or email
 * @param {string} username - Username to check
 * @param {string} email - Email to check
 * @returns {Promise<boolean>} True if user exists
 */
const userExists = async (username: string, email: string): Promise<boolean> => {
  const existingUser = await User.findOne({
    where: {
      [Op.or]: [
        { username },
        { email: email.toLowerCase() }
      ]
    }
  });

  return !!existingUser;
};

/**
 * Hash password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Remove password hash from user object
 * @param {User & UserAttributes} user - User object
 * @returns {Omit<UserAttributes, 'password_hash'>} User without password hash
 */
const sanitizeUser = (user: User & UserAttributes): Omit<UserAttributes, 'password_hash'> => {
  const userJson = user.toJSON();
  delete (userJson as any).password_hash;
  return userJson as Omit<UserAttributes, 'password_hash'>;
};

/**
 * Create a new user
 * @param {CreateUserData} userData - User data
 * @returns {Promise<{ user: Omit<UserAttributes, 'password_hash'>; familyGroupId: number | null }>} Created user and family group ID
 * @throws {Error} If validation fails or user already exists
 */
export const createUser = async (userData: CreateUserData): Promise<{
  user: Omit<UserAttributes, 'password_hash'>;
  familyGroupId: number | null;
}> => {
  const { username, email, password, first_name, last_name, family_group_id, family_group_code } = userData;

  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required');
  }

  // Resolve family group ID from code if provided
  let resolvedFamilyGroupId = family_group_id;
  if (family_group_code) {
    resolvedFamilyGroupId = await resolveFamilyGroupId(family_group_code);
  }

  // Check if user already exists
  if (await userExists(username, email)) {
    throw new Error('User with this username or email already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create new user
  const newUser = await User.create({
    username,
    email: email.toLowerCase(),
    password_hash: hashedPassword,
    first_name,
    last_name,
    family_group_id: resolvedFamilyGroupId
  }) as User & UserAttributes;

  return {
    user: sanitizeUser(newUser),
    familyGroupId: resolvedFamilyGroupId || null
  };
};

/**
 * Get all users
 * @returns {Promise<Omit<UserAttributes, 'password_hash'>[]>} Array of users without password hash
 */
export const getAllUsers = async (): Promise<Omit<UserAttributes, 'password_hash'>[]> => {
  const users = await User.findAll({
    attributes: { exclude: ['password_hash'] }
  });

  return users.map(user => sanitizeUser(user as User & UserAttributes));
};

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise<Omit<UserAttributes, 'password_hash'>>} User without password hash
 * @throws {Error} If user not found
 */
export const getUserById = async (userId: number): Promise<Omit<UserAttributes, 'password_hash'>> => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password_hash'] }
  }) as User & UserAttributes | null;

  if (!user) {
    throw new Error('User not found');
  }

  return sanitizeUser(user);
};

/**
 * Update user
 * @param {number} userId - User ID
 * @param {UpdateUserData} userData - User data to update
 * @returns {Promise<Omit<UserAttributes, 'password_hash'>>} Updated user without password hash
 * @throws {Error} If user not found or validation fails
 */
export const updateUser = async (userId: number, userData: UpdateUserData): Promise<Omit<UserAttributes, 'password_hash'>> => {
  const { username, email, first_name, last_name, family_group_id, avatar_url } = userData;

  const user = await User.findByPk(userId) as User & UserAttributes | null;

  if (!user) {
    throw new Error('User not found');
  }

  // Check if username is being changed and already exists
  if (username && username !== user.username) {
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      throw new Error('Username already taken');
    }
  }

  // Check if email is being changed and already exists
  if (email && email.toLowerCase() !== user.email) {
    const existingEmail = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      throw new Error('Email already in use');
    }
  }

  // Update user
  await user.update({
    username,
    email: email?.toLowerCase(),
    first_name,
    last_name,
    family_group_id,
    avatar_url
  });

  // Get updated user without password hash
  const updatedUser = await User.findByPk(userId, {
    attributes: { exclude: ['password_hash'] }
  }) as User & UserAttributes;

  return sanitizeUser(updatedUser);
};

/**
 * Delete user
 * @param {number} userId - User ID
 * @returns {Promise<void>}
 * @throws {Error} If user not found
 */
export const deleteUser = async (userId: number): Promise<void> => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new Error('User not found');
  }

  await user.destroy();
};

