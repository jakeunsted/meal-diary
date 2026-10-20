export type AlexaSettingsState = 'premium' | 'connected' | 'notConnected';

/** Connected wins so a lapsed Family Plus household can still disconnect. */
export function alexaSettingsState(
  connected: boolean,
  hasAlexa: boolean
): AlexaSettingsState {
  if (connected) {
    return 'connected';
  }
  if (!hasAlexa) {
    return 'premium';
  }
  return 'notConnected';
}
