import { describe, it, expect } from 'vitest';
import { User, FamilyGroup } from '../../db.ts';
import { ValidationError } from 'sequelize';

describe('FamilyGroup Model', () => {
  it('should create a new family group successfully', async () => {
    const user = await User.create({
      username: 'vitest_test_create_family',
      email: 'vitest_test@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();

    const groupData = {
      name: 'Vitest - Test Family',
      created_by: userJson.id,
      random_identifier: 'vitestFive'
    };

    const group = await FamilyGroup.create(groupData);
    const groupJson = group.toJSON();
    expect(groupJson).toBeDefined();
    expect(groupJson.id).toBeDefined();
    expect(groupJson.name).toBe(groupData.name);
    expect(groupJson.created_by).toBe(userJson.id);
  }, 15000);

  it('should require a created_by field', async () => {
    const incompleteData = {
      name: 'Incomplete Group'
      // created_by is intentionally missing
    };

    // Expect specifically a ValidationError for the null violation
    await expect(FamilyGroup.create(incompleteData as any)).rejects.toThrow(ValidationError);
    
    try {
      await FamilyGroup.create(incompleteData as any);
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof ValidationError).toBe(true);
      expect((error as ValidationError).message).toContain('notNull Violation: FamilyGroup.created_by cannot be null');
    }
  }, 15000);

  it('should associate users with a family group', async () => {
    // Create users
    const creator = await User.create({
      username: 'vitest_creator_family_group',
      email: 'vitest_creator_family_group@example.com',
      password_hash: 'hashedpassword123'
    });
    const creatorJson = creator.toJSON();
    expect(creatorJson.id).toBeDefined();

    const member: User = await User.create({
      username: 'vitest_member_family_group',
      email: 'vitest_member_family_group@example.com',
      password_hash: 'hashedpassword456'
    });
    const memberJson = member.toJSON();
    expect(memberJson.id).toBeDefined();

    // Create family group
    const group = await FamilyGroup.create({
      name: 'Vitest - Associated Family Group',
      created_by: creatorJson.id,
      random_identifier: 'vitestSix'
    });
    const groupJson = group.toJSON();
    expect(groupJson.id).toBeDefined();

    // Associate member with group
    await member.update({ family_group_id: groupJson.id });
    
    // Retrieve user with association - use the ID directly
    const updatedMember = await User.findByPk(memberJson.id);

    if (!updatedMember) {
      throw new Error('User not found');
    }
    const updatedMemberJson = updatedMember.toJSON();

    expect(updatedMemberJson.family_group_id).toBe(groupJson.id);

    // Get all users in group
    const usersInGroup = await User.findAll({
      where: { family_group_id: groupJson.id }
    });
    const usersInGroupJson = usersInGroup.map(user => user.toJSON());
    
    expect(usersInGroupJson).toHaveLength(1);
    expect(usersInGroupJson[0].username).toBe('vitest_member_family_group');
  }, 15000); // 15 second timeout
});
