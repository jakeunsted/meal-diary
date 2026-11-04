import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const formSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'RecipeForm.vue'),
  'utf8'
);

describe('recipe form refresh', () => {
  it('does not copy a later recipe into fields after the person has typed', () => {
    expect(formSource).toContain('if (!newData || hasEdited.value)');
    expect(formSource).toContain('hasEdited');
    expect(formSource).not.toContain('watch(() => props.initialData, (newData) => {\n  if (newData) {\n    form.name');
  });
});
