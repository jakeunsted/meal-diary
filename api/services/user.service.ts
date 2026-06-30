import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import sequelize from '../db/models/index.ts';
import User, { type UserAttributes } from '../db/models/User.model.ts';
import FamilyGroup from '../db/models/FamilyGroup.model.ts';
import Recipe from '../db/models/Recipe.model.ts';
import RefreshToken from '../db/models/RefreshToken.model.ts';
import { deleteFamilyGroupData } from './familyGroup.service.ts';
import { deletePersonData } from '../utils/posthog.ts';
import { assertCanAddFamilyMember } from './entitlements.service.ts';
import { normalizeEmail } from '../utils/normalizeEmail.ts';

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  family_group_id?: number;
  family_group_code?: string;
  terms_accepted?: boolean;
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

const MAX_EMAIL_LENGTH = 254;

/**
 * Validate an email address format (linear-time; avoids ReDoS-prone regex).
 * @param {string} email - Email to validate
 * @returns {boolean} True if the email format is valid
 */
export const isValidEmail = (email: string): boolean => {
  if (typeof email !== 'string' || email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
    return false;
  }

  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (localPart.length === 0 || domain.length === 0) {
    return false;
  }

  const dotIndex = domain.indexOf('.');
  if (dotIndex <= 0 || dotIndex === domain.length - 1) {
    return false;
  }

  for (let i = 0; i < email.length; i++) {
    const code = email.charCodeAt(i);
    if (code <= 32 || code === 127) {
      return false;
    }
  }

  return true;
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

export type SanitizedUser = Omit<UserAttributes, 'password_hash'> & {
  // Lets the client choose the right delete-account confirmation
  // (password prompt vs typed DELETE for Google-only users)
  has_password: boolean;
};

/**
 * Remove password hash from user object
 * @param {User & UserAttributes} user - User object
 * @returns {SanitizedUser} User without password hash
 */
export const sanitizeUser = (user: User & UserAttributes): SanitizedUser => {
  const userJson = user.toJSON() as UserAttributes;
  const hasPassword = !!userJson.password_hash;
  delete (userJson as any).password_hash;
  return { ...(userJson as Omit<UserAttributes, 'password_hash'>), has_password: hasPassword };
};

/**
 * Create a new user
 * @param {CreateUserData} userData - User data
 * @returns {Promise<{ user: SanitizedUser; familyGroupId: number | null }>} Created user and family group ID
 * @throws {Error} If validation fails or user already exists
 */
export const createUser = async (userData: CreateUserData): Promise<{
  user: SanitizedUser;
  familyGroupId: number | null;
}> => {
  const { username, email, password, first_name, last_name, family_group_id, family_group_code, terms_accepted } = userData;

  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required');
  }

  if (!isValidEmail(email)) {
    throw new Error('A valid email address is required');
  }

  if (!terms_accepted) {
    throw new Error('Acceptance of the terms of service and privacy policy is required');
  }

  // Resolve family group ID from code if provided
  let resolvedFamilyGroupId = family_group_id;
  if (family_group_code) {
    resolvedFamilyGroupId = await resolveFamilyGroupId(family_group_code);
  }

  if (resolvedFamilyGroupId) {
    const familyGroup = await FamilyGroup.findByPk(resolvedFamilyGroupId);
    if (!familyGroup) {
      throw new Error('Family group not found');
    }
    await assertCanAddFamilyMember(
      resolvedFamilyGroupId,
      Number(familyGroup.dataValues.created_by)
    );
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
    normalized_email: normalizeEmail(email),
    password_hash: hashedPassword,
    first_name,
    last_name,
    family_group_id: resolvedFamilyGroupId,
    terms_accepted_at: new Date()
  }) as User & UserAttributes;

  return {
    user: sanitizeUser(newUser),
    familyGroupId: resolvedFamilyGroupId || null
  };
};

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise<SanitizedUser>} User without password hash
 * @throws {Error} If user not found
 */
export const getUserById = async (userId: number): Promise<SanitizedUser> => {
  // password_hash is fetched so sanitizeUser can derive has_password,
  // then stripped before the user is returned
  const user = await User.findByPk(userId) as User & UserAttributes | null;

  if (!user) {
    throw new Error('User not found');
  }

  return sanitizeUser(user);
};

/**
 * Update user
 * @param {number} userId - User ID
 * @param {UpdateUserData} userData - User data to update
 * @returns {Promise<SanitizedUser>} Updated user without password hash
 * @throws {Error} If user not found or validation fails
 */
export const updateUser = async (userId: number, userData: UpdateUserData): Promise<SanitizedUser> => {
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
    if (!isValidEmail(email)) {
      throw new Error('A valid email address is required');
    }

    const existingEmail = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      throw new Error('Email already in use');
    }
  }

  // Update user
  await user.update({
    username,
    email: email?.toLowerCase(),
    normalized_email: email ? normalizeEmail(email) : undefined,
    first_name,
    last_name,
    family_group_id,
    avatar_url
  });

  // Re-fetch and sanitize (strips password_hash, adds has_password)
  const updatedUser = await User.findByPk(userId) as User & UserAttributes;

  return sanitizeUser(updatedUser);
};

export interface DeleteAccountInput {
  password?: string;
  confirmation?: string;
}

/**
 * Permanently delete a user's account and personal data.
 *
 * Confirmation: users with a password must supply it; Google-only users
 * must send confirmation: 'DELETE' instead.
 *
 * Family handling: if the user created a family group that still has other
 * members, deletion is blocked (they must delete the family or transfer it
 * first). Groups they created with no other members are cascade-deleted.
 * Recipes they created in surviving groups are kept but anonymised.
 *
 * PostHog person data is deleted best-effort after the transaction commits.
 */
export const deleteUserAccount = async (
  userId: number,
  input: DeleteAccountInput
): Promise<void> => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const passwordHash = user.dataValues.password_hash;
  if (passwordHash) {
    if (!input.password) {
      throw new Error('Password confirmation is required');
    }
    const passwordValid = await bcrypt.compare(input.password, passwordHash);
    if (!passwordValid) {
      throw new Error('Password is incorrect');
    }
  } else if (input.confirmation !== 'DELETE') {
    throw new Error('Type DELETE to confirm account deletion');
  }

  // Family groups this user created: block if any still have other members,
  // cascade-delete the ones that are now solely theirs
  const createdGroups = await FamilyGroup.findAll({ where: { created_by: userId } });
  const groupIdsToDelete: number[] = [];
  for (const group of createdGroups) {
    const groupId = group.dataValues.id;
    const otherMembers = await User.count({
      where: { family_group_id: groupId, id: { [Op.ne]: userId } },
    });
    if (otherMembers > 0) {
      throw new Error('You created a family group that still has other members. Delete the family or transfer ownership before deleting your account');
    }
    groupIdsToDelete.push(groupId);
  }

  await sequelize.transaction(async (transaction) => {
    for (const groupId of groupIdsToDelete) {
      await deleteFamilyGroupData(groupId, transaction);
    }

    // Keep recipes in surviving family groups, but unlink the creator
    await Recipe.update(
      { created_by: null },
      { where: { created_by: userId }, transaction }
    );

    await RefreshToken.destroy({ where: { user_id: userId }, transaction });
    await user.destroy({ transaction });
  });

  // GDPR erasure in PostHog — best-effort, never blocks the deletion
  deletePersonData(userId.toString()).catch((err) => {
    console.error('Failed to queue PostHog person deletion:', err);
  });
};

