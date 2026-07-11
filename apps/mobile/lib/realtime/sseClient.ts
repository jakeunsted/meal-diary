import EventSource from 'react-native-sse';

import { env } from '@/constants/env';
import { getAccessToken } from '@/lib/auth/tokenStorage';

export interface FamilySseMessage {
  type: string;
  data: unknown;
}

export type FamilySseMessageHandler = (message: FamilySseMessage) => void;

interface ConnectFamilySseOptions {
  familyGroupId: number;
  onMessage: FamilySseMessageHandler;
  onError?: (message: string) => void;
}

export interface FamilySseConnection {
  close: () => void;
}

export async function connectFamilySse({
  familyGroupId,
  onMessage,
  onError,
}: ConnectFamilySseOptions): Promise<FamilySseConnection> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available for SSE');
  }

  const url = `${env.apiUrl}/sse/${familyGroupId}`;
  const eventSource = new EventSource(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    pollingInterval: 0,
  });

  let closed = false;

  eventSource.addEventListener('message', (event) => {
    if (!event.data) {
      return;
    }

    try {
      const parsed = JSON.parse(event.data) as FamilySseMessage;
      if (!parsed?.type) {
        return;
      }
      onMessage(parsed);
    } catch (error) {
      console.error('[SSE] Failed to parse message:', error);
    }
  });

  eventSource.addEventListener('error', (event) => {
    if (closed) {
      return;
    }
    onError?.('message' in event ? event.message : 'SSE connection error');
  });

  return {
    close: () => {
      closed = true;
      eventSource.removeAllEventListeners();
      eventSource.close();
    },
  };
}
