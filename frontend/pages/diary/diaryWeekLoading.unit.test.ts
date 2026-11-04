import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('diary week refresh', () => {
  it('does not block the week while meals are already on screen', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.vue'), 'utf8');

    expect(source).not.toContain('opacity-50 pointer-events-none');
    expect(source).not.toContain('absolute inset-0');
    expect(source).toContain('data-testid="diary-week-loading"');
  });
});
