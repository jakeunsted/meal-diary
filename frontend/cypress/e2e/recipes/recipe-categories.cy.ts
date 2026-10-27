const starterCategories = [
  { id: 1, family_group_id: 1, name: 'Breakfast', is_default: true, default_key: 'breakfast', assignable: true },
  { id: 2, family_group_id: 1, name: 'Lunch', is_default: true, default_key: 'lunch', assignable: true },
  { id: 3, family_group_id: 1, name: 'Dinner', is_default: true, default_key: 'dinner', assignable: true },
  { id: 4, family_group_id: 1, name: 'Dessert', is_default: true, default_key: 'dessert', assignable: true },
];

const slowCooker = {
  id: 9,
  family_group_id: 1,
  name: 'Slow cooker',
  is_default: false,
  default_key: null,
  assignable: true,
};

const openRecipeBook = () => {
  cy.loginViaUi();
  cy.get('[data-testid="nav-recipes"]').click();
  cy.location('pathname').should('eq', '/recipes');
  cy.wait('@apiGetRecipes');
  cy.wait('@apiGetRecipeCategories');
};

describe('Recipe categories', () => {
  it('filters the book from All, a category, and Uncategorized', () => {
    cy.mockApi({
      recipes: [
        {
          id: 501,
          name: 'Stew',
          categories: [
            { id: 3, name: 'Dinner', is_default: true, default_key: 'dinner', assignable: true },
            slowCooker,
          ],
        },
        {
          id: 502,
          name: 'Plain Rice',
          categories: [],
        },
      ],
      recipeCategories: [...starterCategories, slowCooker],
    });
    openRecipeBook();

    cy.get('[data-testid="recipe-category-tab-all"]').should('have.attr', 'aria-selected', 'true');
    cy.get('[data-testid="recipe-category-tab-count-all"]').should('have.text', '2');
    cy.contains('Stew').should('be.visible');
    cy.contains('Plain Rice').should('be.visible');

    cy.get('[data-testid="recipe-category-tab-3"]').click();
    cy.get('[data-testid="recipe-category-tab-3"]').should('have.attr', 'aria-selected', 'true');
    cy.contains('Stew').should('be.visible');
    cy.contains('Plain Rice').should('not.exist');

    cy.get('[data-testid="recipe-category-tab-9"]').click();
    cy.contains('Stew').should('be.visible');
    cy.contains('Plain Rice').should('not.exist');

    cy.get('[data-testid="recipe-category-tab-uncategorized"]').click();
    cy.contains('Plain Rice').should('be.visible');
    cy.contains('Stew').should('not.exist');

    cy.get('[data-testid="recipe-category-tab-count-1"]').should('have.text', '0');
    cy.get('[data-testid="recipe-category-tab-1"]').click();
    cy.contains('No recipes in Breakfast yet').should('be.visible');
  });

  it('says every recipe is categorized when Uncategorized is empty', () => {
    cy.mockApi({
      recipes: [
        {
          id: 501,
          name: 'Stew',
          categories: [
            { id: 3, name: 'Dinner', is_default: true, default_key: 'dinner', assignable: true },
          ],
        },
      ],
    });
    openRecipeBook();

    cy.get('[data-testid="recipe-category-tab-count-uncategorized"]').should('have.text', '0');
    cy.get('[data-testid="recipe-category-tab-uncategorized"]').click();
    cy.contains('Every recipe is in a category').should('be.visible');
  });

  it('adds a custom category on Family Plus, assigns it, and keeps the recipe when it is deleted', () => {
    cy.mockApi();
    openRecipeBook();

    cy.get('[data-testid="recipes-new-button"]').click();
    cy.get('[data-testid="recipe-create-method-manual"]').click();
    cy.get('[data-testid="recipe-form-name-input"]').type('Weeknight Stew');
    cy.get('[data-testid="recipe-category-option-3"]').find('input').check();
    cy.get('[data-testid="recipe-form-submit-button"]').click();

    cy.wait('@apiCreateRecipe').its('request.body.category_ids').should('deep.equal', [3]);
    cy.get('[data-testid="recipe-category-label-3"]').should('contain', 'Dinner');

    cy.contains('button', 'Back').click();
    cy.location('pathname').should('eq', '/recipes');
    cy.get('[data-testid="recipe-category-tab-count-3"]').should('have.text', '1');
    cy.get('[data-testid="recipe-category-tab-count-1"]').should('have.text', '0');

    cy.get('[data-testid="recipe-categories-manage"]').click();
    cy.get('[data-testid="recipe-category-add"]').click();
    cy.get('[data-testid="recipe-category-name-input"]').type('Slow cooker');
    cy.get('[data-testid="recipe-category-name-submit"]').click();
    cy.wait('@apiCreateRecipeCategory');
    cy.get('[data-testid="recipe-category-manager-list"]').should('contain', 'Slow cooker');
    cy.get('[data-testid="recipe-category-manager-close"]').click();

    cy.get('[data-testid="recipe-category-tab-5"]').should('contain', 'Slow cooker');
    cy.contains('[data-testid^="recipe-card-"]', 'Weeknight Stew').click();
    cy.get('[data-testid="recipe-edit-button"]').click();
    cy.get('[data-testid="recipe-category-option-5"]').find('input').check();
    cy.get('[data-testid="recipe-form-submit-button"]').click();
    cy.wait('@apiUpdateRecipe').its('request.body.category_ids').should('deep.equal', [3, 5]);
    cy.get('[data-testid="recipe-category-label-5"]').should('contain', 'Slow cooker');

    cy.contains('button', 'Back').click();
    cy.get('[data-testid="recipe-category-tab-5"]').click();
    cy.contains('Weeknight Stew').should('be.visible');
    cy.contains('Pasta Bake').should('not.exist');
    cy.get('[data-testid="recipe-category-tab-3"]').click();
    cy.contains('Weeknight Stew').should('be.visible');

    cy.get('[data-testid="recipe-category-tab-5"]').click();
    cy.get('[data-testid="recipe-categories-manage"]').click();
    cy.get('[data-testid="recipe-category-delete-5"]').click();
    cy.contains('This removes Slow cooker from every recipe in the household. The recipes stay.').should('be.visible');
    cy.get('[data-testid="recipe-category-delete-confirm"]').click();
    cy.wait('@apiDeleteRecipeCategory');
    cy.get('[data-testid="recipe-category-manager-close"]').click();

    cy.get('[data-testid="recipe-category-tab-all"]').should('have.attr', 'aria-selected', 'true');
    cy.contains('Weeknight Stew').should('be.visible');
    cy.get('[data-testid="recipe-category-tab-5"]').should('not.exist');
  });

  it('opens the paywall when a free household adds a category', () => {
    cy.mockApi({ entitlementsProfile: 'free' });
    cy.intercept('POST', /\/api\/family-groups\/\d+\/recipe-categories$/, () => {
      throw new Error('Category create should not run when Family Plus is off');
    });
    openRecipeBook();

    cy.get('[data-testid="recipe-categories-manage"]').click();
    cy.get('[data-testid="recipe-category-lapsed-note"]').should('be.visible');
    cy.get('[data-testid="recipe-category-starter-1"]').should('contain', 'Breakfast');
    cy.get('[data-testid="recipe-category-add"]').click();
    cy.get('[data-testid="recipe-category-name-input"]').should('not.exist');
    cy.get('[data-testid="paywall-modal"]').should('be.visible');
    cy.get('[data-testid="paywall-modal"]').should('contain', 'Custom recipe categories');
  });

  it('removes a lapsed custom label and does not offer it again', () => {
    cy.mockApi({
      entitlementsProfile: 'free',
      recipes: [
        {
          id: 701,
          name: 'Sunday Stew',
          categories: [
            {
              id: 9,
              name: 'Slow cooker',
              is_default: false,
              default_key: null,
              assignable: false,
            },
          ],
        },
      ],
      recipeCategories: [...starterCategories, slowCooker],
    });
    openRecipeBook();

    cy.get('[data-testid="recipe-category-tab-9"]').should('not.exist');
    cy.contains('[data-testid^="recipe-card-"]', 'Sunday Stew').click();
    cy.get('[data-testid="recipe-category-label-9"]').should('contain', 'Slow cooker');
    cy.get('[data-testid="recipe-edit-button"]').click();
    cy.get('[data-testid="recipe-category-locked-9"]').should('be.visible');
    cy.contains('Family Plus is needed to add this again').should('be.visible');
    cy.get('[data-testid="recipe-category-option-9"]').should('not.exist');
    cy.get('[data-testid="recipe-category-remove-9"]').click();
    cy.get('[data-testid="recipe-category-locked-9"]').should('not.exist');
    cy.contains('Slow cooker').should('not.exist');
    cy.get('[data-testid="recipe-form-submit-button"]').click();

    cy.wait('@apiUpdateRecipe').its('request.body.category_ids').should('deep.equal', []);
    cy.contains('Slow cooker').should('not.exist');
    cy.get('[data-testid="recipe-edit-button"]').click();
    cy.get('[data-testid="recipe-category-locked-9"]').should('not.exist');
    cy.get('[data-testid="recipe-category-option-9"]').should('not.exist');
    cy.contains('Slow cooker').should('not.exist');
    cy.get('[data-testid="recipe-category-option-3"]').should('contain', 'Dinner');
  });
});
