import { describe, it, expect } from 'vitest';
import { User, FamilyGroup } from '../db.ts';
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
      created_by: userJson.id
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
      username: 'vitest_creator_family',
      email: 'vitest_creator@example.com',
      password_hash: 'hashedpassword123'
    });
    const creatorJson = creator.toJSON();

    const member = await User.create({
      username: 'vitest_member_family',
      email: 'vitest_member@example.com',
      password_hash: 'hashedpassword456'
    });
    const memberJson = member.toJSON();

    // Create family group
    const group = await FamilyGroup.create({
      name: 'Vitest - Associated Family',
      created_by: creatorJson.id
    });
    const groupJson = group.toJSON();

    // Associate member with group
    await member.update({ family_group_id: groupJson.id });

    // Retrieve user with association
    const updatedMember = await User.findByPk(memberJson.id);
    const updatedMemberJson = updatedMember?.toJSON();
    expect(updatedMemberJson?.family_group_id).toBe(groupJson.id);

    // Get all users in group
    const usersInGroup = await User.findAll({
      where: { family_group_id: groupJson.id }
    });
    const usersInGroupJson = usersInGroup.map(user => user.toJSON());
    
    expect(usersInGroupJson).toHaveLength(1);
    expect(usersInGroupJson[0].username).toBe('vitest_member_family');
  }, 15000); // 15 second timeout
});
