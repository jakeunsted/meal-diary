import { describe, expect, it } from 'vitest';

import {
  DEVELOPMENT_API_URL,
  PRODUCTION_API_URL,
  PRODUCTION_WEB_URL,
  resolvePublicUrls,
} from './env';

describe('resolvePublicUrls', () => {
  it('keeps local API and web URLs in development', () => {
    expect(
      resolvePublicUrls({
        apiUrl: 'http://10.0.2.2:3001',
        webUrl: 'http://dev-app.mealdiary.co.uk',
        isDev: true,
      })
    ).toEqual({
      apiUrl: 'http://10.0.2.2:3001',
      webUrl: 'http://dev-app.mealdiary.co.uk',
    });
  });

  it('replaces local hosts in production even if .env.local leaked in', () => {
    expect(
      resolvePublicUrls({
        apiUrl: 'http://10.0.2.2:3002',
        webUrl: 'http://dev-app.mealdiary.co.uk',
        isDev: false,
      })
    ).toEqual({
      apiUrl: PRODUCTION_API_URL,
      webUrl: PRODUCTION_WEB_URL,
    });
  });

  it('upgrades cleartext production API URLs to HTTPS', () => {
    expect(
      resolvePublicUrls({
        apiUrl: 'http://api.mealdiary.co.uk',
        webUrl: PRODUCTION_WEB_URL,
        isDev: false,
      })
    ).toEqual({
      apiUrl: PRODUCTION_API_URL,
      webUrl: PRODUCTION_WEB_URL,
    });
  });

  it('falls back to emulator API in development and production hosts in release', () => {
    expect(resolvePublicUrls({ isDev: true })).toEqual({
      apiUrl: DEVELOPMENT_API_URL,
      webUrl: PRODUCTION_WEB_URL,
    });
    expect(resolvePublicUrls({ isDev: false })).toEqual({
      apiUrl: PRODUCTION_API_URL,
      webUrl: PRODUCTION_WEB_URL,
    });
  });
});
