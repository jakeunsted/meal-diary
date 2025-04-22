import { describe, it, expect } from 'vitest';
import { FamilyGroup, ShoppingList, User } from '../../db.ts';

describe('ShoppingList Model', () => {
  it('should create a new shopping list successfully', async () => {
    // Create a test user first
    const user = await User.create({
      username: 'vitest_test_shopping_list',
      email: 'vitest_test_shopping_list@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();
    expect(userJson.id).toBeDefined();

    // Create a family group
    const familyGroup = await FamilyGroup.create({
      name: 'Vitest - Shopping List Test',
      created_by: userJson.id
    });
    const familyGroupJson = familyGroup.toJSON();
    expect(familyGroupJson.id).toBeDefined();

    // Create a shopping list
    const shoppingList = await ShoppingList.create({
      family_group_id: familyGroupJson.id,
      content: {
        categories: [
          {
            id: 1,
            name: 'Fruits & Vegetables',
            items: [
              { id: 1, name: 'Apples', checked: false },
              { id: 2, name: 'Bananas', checked: true }
            ]
          }
        ]
      }
    });
    const shoppingListJson = shoppingList.toJSON();

    expect(shoppingListJson.id).toBeDefined();
    expect(shoppingListJson.family_group_id).toBe(familyGroupJson.id);
    expect(shoppingListJson.content).toHaveProperty('categories');
    expect(shoppingListJson.content.categories).toHaveLength(1);
    expect(shoppingListJson.content.categories[0].name).toBe('Fruits & Vegetables');
  }, 15000);

  it('should create a shopping list with default content when not provided', async () => {
    // Create a test user
    const user = await User.create({
      username: 'vitest_test_default_content',
      email: 'vitest_test_default_content@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();

    // Create a family group
    const familyGroup = await FamilyGroup.create({
      name: 'Vitest - Default Content Test',
      created_by: userJson.id
    });
    const familyGroupJson = familyGroup.toJSON();

    // Create a shopping list without specifying content
    const shoppingList = await ShoppingList.create({
      family_group_id: familyGroupJson.id
    });
    const shoppingListJson = shoppingList.toJSON();

    expect(shoppingListJson.id).toBeDefined();
    expect(shoppingListJson.content).toEqual({ categories: [] });
  }, 15000);

  it('should update shopping list content successfully', async () => {
    // Create a test user
    const user = await User.create({
      username: 'vitest_test_update_list',
      email: 'vitest_test_update_list@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();

    // Create a family group
    const familyGroup = await FamilyGroup.create({
      name: 'Vitest - Update List Test',
      created_by: userJson.id
    });
    const familyGroupJson = familyGroup.toJSON();

    // Create a shopping list
    const shoppingList = await ShoppingList.create({
      family_group_id: familyGroupJson.id,
      content: { categories: [] }
    });

    // Update the shopping list
    const updatedContent = {
      categories: [
        {
          id: 1,
          name: 'Dairy',
          items: [
            { id: 1, name: 'Milk', checked: false },
            { id: 2, name: 'Cheese', checked: false }
          ]
        }
      ]
    };

    await shoppingList.update({ content: updatedContent });
    
    // Fetch the updated shopping list
    const updatedShoppingList = await ShoppingList.findByPk(shoppingList.dataValues.id);
    if (!updatedShoppingList) {
      throw new Error('Shopping list not found');
    }
    
    const updatedShoppingListJson = updatedShoppingList.toJSON();
    expect(updatedShoppingListJson.content).toEqual(updatedContent);
    expect(updatedShoppingListJson.content.categories[0].name).toBe('Dairy');
    expect(updatedShoppingListJson.content.categories[0].items).toHaveLength(2);
  }, 15000);

  it('should require a family_group_id', async () => {
    try {
      // Attempt to create a shopping list without a family_group_id
      await ShoppingList.create({
        content: { categories: [] }
      } as any);
      
      // If we reach here, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('notNull Violation');
    }
  }, 15000);
});
