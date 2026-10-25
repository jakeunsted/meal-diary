import { defineNuxtPlugin } from '#app'
import { useAuthStore } from '~/stores/auth';

interface SSEHandlers {
  [key: string]: (data: any) => void;
}

interface SseConnection {
  close: () => void;
}

const RECONNECT_DELAY_MS = 5000;

export default defineNuxtPlugin(() => {
  let connection: SseConnection | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let isReconnecting = false;

  const closeSSE = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    isReconnecting = false;
    if (connection) {
      connection.close();
      connection = null;
    }
  };

  const setupSSE = (familyGroupId: number, handlers: SSEHandlers): SseConnection | null => {
    if (!import.meta.client) {
      return null;
    }

    closeSSE();

    let aborted = false;
    const controller = new AbortController();

    const scheduleReconnect = () => {
      if (aborted || isReconnecting) {
        return;
      }
      isReconnecting = true;
      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        isReconnecting = false;
        if (!aborted) {
          void connect();
        }
      }, RECONNECT_DELAY_MS);
    };

    const connect = async () => {
      const accessToken = useAuthStore().accessToken;
      if (!accessToken) {
        scheduleReconnect();
        return;
      }

      try {
        const response = await fetch(`/api/server-sent-events/${familyGroupId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          scheduleReconnect();
          return;
        }

        isReconnecting = false;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!aborted) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
            if (!dataLine) {
              continue;
            }
            try {
              const payload = JSON.parse(dataLine.slice('data: '.length));
              if (handlers[payload.type]) {
                handlers[payload.type](payload.data);
              }
            } catch (error) {
              console.error('[SSE Plugin] Error parsing SSE message:', error, dataLine);
            }
          }
        }
      } catch (error) {
        if (aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        console.error('[SSE Plugin] Stream failed:', error);
      }

      if (!aborted) {
        scheduleReconnect();
      }
    };

    connection = {
      close: () => {
        aborted = true;
        controller.abort();
      },
    };
    void connect();
    return connection;
  };

  return {
    provide: {
      sse: {
        setup: setupSSE,
        close: closeSSE
      }
    }
  }
})
