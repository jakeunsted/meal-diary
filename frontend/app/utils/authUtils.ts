/**
 * Utility function to check if a user has a family group
 * @param {any} user - The user object to check
 * @returns {boolean} True if the user has a family group, false otherwise
 */
export const hasFamilyGroup = (user: any): boolean => {
  return user?.family_group_id != null && user.family_group_id !== undefined;
}; 