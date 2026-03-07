import { installMockApi } from './mockApi';

interface MockApiOptions {
  userWithoutFamilyGroup?: boolean;
}

interface LoginViaUiOptions {
  email?: string;
  password?: string;
}

const stubEventSource = (win: Window) => {
  class FakeEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;

    readyState = FakeEventSource.OPEN;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    url: string;

    constructor(url: string) {
      this.url = url;
      setTimeout(() => {
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
      }, 0);
    }

    close() {
      this.readyState = FakeEventSource.CLOSED;
    }
  }

  Object.defineProperty(win, 'EventSource', {
    value: FakeEventSource,
    writable: true,
    configurable: true,
  });
};

const stubClipboard = (win: Window) => {
  const clipboard = {
    writeText: () => Promise.resolve(),
  };
  Object.defineProperty(win.navigator, 'clipboard', {
    value: clipboard,
    writable: true,
    configurable: true,
  });
};

Cypress.Commands.add('mockApi', (options: MockApiOptions = {}) => {
  installMockApi(options);
});

Cypress.Commands.add('visitApp', (url: string, options: Partial<Cypress.VisitOptions> = {}) => {
  const existingOnBeforeLoad = options.onBeforeLoad;
  cy.visit(url, {
    ...options,
    onBeforeLoad(win) {
      stubEventSource(win);
      stubClipboard(win);
      if (existingOnBeforeLoad) {
        existingOnBeforeLoad(win);
      }
    },
  });
});

Cypress.Commands.add('loginViaUi', (options: LoginViaUiOptions = {}) => {
  cy.visitApp('/login');
  cy.get('[data-testid="login-email-input"]').clear().type(options.email || 'user@example.com');
  cy.get('[data-testid="login-password-input"]').clear().type(options.password || 'password123');
  cy.get('[data-testid="login-submit-button"]').click();
  cy.wait('@apiLogin');
});

declare global {
  namespace Cypress {
    interface Chainable {
      mockApi(options?: MockApiOptions): Chainable<void>;
      visitApp(url: string, options?: Partial<VisitOptions>): Chainable<void>;
      loginViaUi(options?: LoginViaUiOptions): Chainable<void>;
    }
  }
}

export {};
