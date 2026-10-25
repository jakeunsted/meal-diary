import { describe, expect, it } from 'vitest';
import { productionDatabaseSsl } from '../productionSsl.ts';

const pem = [
  '-----BEGIN CERTIFICATE-----',
  'MIIB',
  '-----END CERTIFICATE-----',
].join('\n');

describe('productionDatabaseSsl', () => {
  it('requires the CA and verifies the server certificate', () => {
    expect(productionDatabaseSsl(pem)).toEqual({
      require: true,
      rejectUnauthorized: true,
      ca: pem,
    });
  });

  it('accepts a CA stored with escaped newlines', () => {
    const stored = pem.replace(/\n/g, '\\n');

    expect(productionDatabaseSsl(stored).ca).toBe(pem);
  });

  it('rejects a missing or headerless CA', () => {
    expect(() => productionDatabaseSsl(undefined)).toThrow('DATABASE_SSL_CA is required in production');
    expect(() => productionDatabaseSsl('MIIB')).toThrow('DATABASE_SSL_CA is required in production');
  });
});
