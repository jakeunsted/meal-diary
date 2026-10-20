import { describe, expect, it } from 'vitest';
import {
  diaryDateForAlexa,
  selectLegacySlot,
  speakFood,
  speakFullDay,
  speakMissingLegacyMeal,
  speakNamedMeal,
  type SpokenSlot,
} from '../alexaSpeech.service.ts';

const dinner: SpokenSlot = {
  name: 'Supper',
  position: 3,
  legacyKey: 'dinner',
  dish: 'pasta',
  recipeName: null,
};

const snack: SpokenSlot = {
  name: 'Snack',
  position: 4,
  legacyKey: null,
  dish: 'fruit',
  recipeName: null,
};

describe('alexaSpeech.service', () => {
  it('speaks nothing planned for an empty slot and an empty day', () => {
    expect(speakNamedMeal('Dinner', speakFood('  \n', null), 'today')).toBe(
      'Dinner, nothing planned.'
    );
    expect(speakNamedMeal('Dinner', null, 'tomorrow')).toBe(
      'Tomorrow, Dinner, nothing planned.'
    );
    expect(
      speakFullDay('Smith', [{ ...dinner, dish: '   ', recipeName: null }], 'today')
    ).toBe('Nothing is planned in the meal diary today.');
    expect(speakFullDay(null, [], 'tomorrow')).toBe(
      'Nothing is planned in the meal diary tomorrow.'
    );
  });

  it('answers a renamed dinner by legacy_key and speaks the family slot name', () => {
    const slot = selectLegacySlot([snack, dinner], 'dinner');
    expect(slot?.name).toBe('Supper');
    expect(speakNamedMeal(slot?.name ?? '', speakFood(slot?.dish, slot?.recipeName), 'today')).toBe(
      'Supper is pasta.'
    );
    expect(speakNamedMeal('Supper', 'pasta', 'tomorrow')).toBe('Tomorrow, Supper is pasta.');
  });

  it('includes a null legacy_key slot on the full day and not on the named meal', () => {
    const slots = [
      { name: 'Breakfast', position: 1, legacyKey: 'breakfast' as const, dish: null, recipeName: null },
      dinner,
      snack,
    ];
    expect(selectLegacySlot(slots, 'dinner')).toEqual(dinner);
    expect(selectLegacySlot(slots, 'lunch')).toBeNull();
    expect(speakMissingLegacyMeal('lunch')).toBe('Nothing is planned for lunch.');
    expect(speakFullDay('Smith', slots, 'today')).toBe(
      'Today in Smith. Breakfast, nothing planned. Supper, pasta. Snack, fruit.'
    );
  });

  it('falls back to the family recipe name when the dish is empty', () => {
    expect(speakFood('', 'Pasta bake')).toBe('Pasta bake');
    expect(speakFood('pasta\nbake', null)).toBe('pasta bake');
    expect(speakNamedMeal('Dinner', speakFood('   ', 'Pasta bake'), 'today')).toBe(
      'Dinner is Pasta bake.'
    );
  });

  it('rolls Sunday tomorrow onto next Monday in Europe/London', () => {
    // 23:30 UTC is 00:30 the next morning in London (BST), which is Sunday 18 Oct 2026.
    // The same instant is still Saturday in UTC, so a server UTC calendar must not be used.
    const timestamp = '2026-10-17T23:30:00.000Z';
    expect(new Date(timestamp).toISOString().slice(0, 10)).toBe('2026-10-17');

    expect(diaryDateForAlexa(timestamp, 'Europe/London', 'today')).toEqual({
      weekStartDate: '2026-10-12',
      dayOfWeek: 7,
      civilDate: '2026-10-18',
    });
    expect(diaryDateForAlexa(timestamp, 'Europe/London', 'tomorrow')).toEqual({
      weekStartDate: '2026-10-19',
      dayOfWeek: 1,
      civilDate: '2026-10-19',
    });
  });
});
