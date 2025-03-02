import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { User, FamilyGroup, sequelize } from '../../db/db.ts';
import { Op, ValidationError } from 'sequelize';

describe('FamilyGroup Model', () => {
  // Setup and teardown
  beforeAll(async () => {
    // Increase timeout to 30 seconds
    await sequelize.sync({ force: true });
  }, 30000); // 30 second timeout

  afterAll(async () => {
    await sequelize.close();
  }, 30000); // 30 second timeout

  beforeEach(async () => {
    // Clear all test data
    await FamilyGroup.destroy({ where: { name: { [Op.like]: 'Vitest -%' } } });
    await User.destroy({ where: { username: { [Op.like]: 'vitest_%' } } });
  }, 15000); // 15 second timeout

  // Tests
  it('should create a new family group successfully', async () => {
    const user = await User.create({
      username: 'vitest_test',
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
      username: 'vitest_creator',
      email: 'vitest_creator@example.com',
      password_hash: 'hashedpassword123'
    });
    const creatorJson = creator.toJSON();

    const member = await User.create({
      username: 'vitest_member',
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
    expect(usersInGroupJson[0].username).toBe('vitest_member');
  }, 15000); // 15 second timeout
});
