describe('Workspace tiles', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.mockApi();
    cy.loginViaUi();
    cy.location('pathname').should('eq', '/diary');
    cy.get('[data-testid="workspace-shell"]').should('have.attr', 'data-mode', 'board');
  });

  it('shows diary, recipes, and shopping list with a top nav', () => {
    cy.get('[data-testid="workspace-tile-diary"]').should('be.visible');
    cy.get('[data-testid="workspace-tile-recipes"]').should('be.visible');
    cy.get('[data-testid="workspace-tile-shopping-list"]').should('be.visible');
    cy.get('[data-testid="top-nav"]').should('be.visible');
    cy.get('[data-testid="nav-diary"]').should('not.exist');

    cy.get('[data-testid="top-nav-profile"]').click();
    cy.location('pathname').should('eq', '/profile');
    cy.get('[data-testid="workspace-shell"]').should('not.exist');
    cy.get('[data-testid="top-nav"]').should('be.visible');
    cy.get('[data-testid="profile-header"], [data-testid="family-details"], h1, h2').should('exist');
  });

  it('keeps a resized diary pane after reload', () => {
    cy.get('[data-testid="workspace-board-diary-handle"]').then(($handle) => {
      const rect = $handle[0].getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      cy.wrap($handle).trigger('pointerdown', {
        clientX: x,
        clientY: y,
        pointerId: 1,
        button: 0,
      });
      cy.get('body').trigger('pointermove', {
        clientX: x,
        clientY: y + 140,
        pointerId: 1,
        button: 0,
      });
      cy.get('body').trigger('pointerup', {
        clientX: x,
        clientY: y + 140,
        pointerId: 1,
        button: 0,
      });
    });

    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem('meal-diary-workspace') || '{}');
      expect(saved.boardDiaryFraction).to.be.greaterThan(0.5);
    });

    cy.reload();
    cy.get('[data-testid="workspace-shell"]').should('have.attr', 'data-mode', 'board');
    cy.get('[data-testid="workspace-board"]').should(($board) => {
      expect(Number($board.attr('data-fraction'))).to.be.greaterThan(0.5);
    });
  });

  it('uses two side by side tiles and remembers a switched view', () => {
    cy.viewport(900, 600);
    cy.get('[data-testid="workspace-split"]').should('have.attr', 'data-axis', 'row');
    cy.get('[data-testid="workspace-tile-select-1"]').select('recipes');
    cy.get('[data-testid="workspace-tile-recipes"]').should('exist');

    cy.reload();
    cy.get('[data-testid="workspace-split"]').should('have.attr', 'data-axis', 'row');
    cy.get('[data-testid="workspace-tile-select-1"]').should('have.value', 'recipes');
  });

  it('stacks two tiles when the workspace is taller than it is wide', () => {
    cy.viewport(800, 1100);
    cy.get('[data-testid="workspace-split"]').should('have.attr', 'data-axis', 'column');
  });
});
