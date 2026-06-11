import { describe, it, expect } from 'vitest';
import { ValidationError } from 'sequelize';
import { User, FamilyGroup } from '../associations.ts';

describe('FamilyGroup Model', () => {
  it('should build a valid family group that passes validation', async () => {
    const group = FamilyGroup.build({
      name: 'Vitest - Test Family',
      created_by: 1,
      random_identifier: 'aaaa-bbbb-cccc',
    });

    await expect(group.validate()).resolves.not.toThrow();

    const groupJson = group.toJSON();
    expect(groupJson.name).toBe('Vitest - Test Family');
    expect(groupJson.created_by).toBe(1);
  });

  it('should require a created_by field', async () => {
    const group = FamilyGroup.build({
      name: 'Incomplete Group',
      random_identifier: 'aaaa-bbbb-cccc',
      // created_by is intentionally missing
    } as never);

    await expect(group.validate()).rejects.toThrow(ValidationError);
    await expect(group.validate()).rejects.toThrow(
      'notNull Violation: FamilyGroup.created_by cannot be null'
    );
  });

  it('should require random_identifier to be exactly 14 characters', async () => {
    const tooShort = FamilyGroup.build({
      name: 'Vitest - Bad Identifier',
      created_by: 1,
      random_identifier: 'vitestFive',
    });

    await expect(tooShort.validate()).rejects.toThrow(ValidationError);
    await expect(tooShort.validate()).rejects.toThrow(
      'Validation len on random_identifier failed'
    );
  });

  it('should associate users with a family group', () => {
    expect(FamilyGroup.associations.Users).toBeDefined();
    expect(FamilyGroup.associations.Users.foreignKey).toBe('family_group_id');

    expect(User.associations.FamilyGroup).toBeDefined();
    expect(User.associations.FamilyGroup.foreignKey).toBe('family_group_id');
  });
});
