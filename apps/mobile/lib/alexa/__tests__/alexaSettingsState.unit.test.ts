import { describe, expect, it } from 'vitest';

import { alexaSettingsState } from '@/lib/alexa/alexaSettingsState';

describe('alexaSettingsState', () => {
  it('returns premium when the family is not connected and does not have Alexa', () => {
    expect(alexaSettingsState(false, false)).toBe('premium');
  });

  it('returns notConnected when Family Plus is not linked yet', () => {
    expect(alexaSettingsState(false, true)).toBe('notConnected');
  });

  it('returns connected when Alexa is linked', () => {
    expect(alexaSettingsState(true, true)).toBe('connected');
  });

  it('returns connected when a link remains after premium lapses', () => {
    expect(alexaSettingsState(true, false)).toBe('connected');
  });
});
