import { defineNuxtPlugin } from '#app'

interface SSEHandlers {
  [key: string]: (data: any) => void;
}

export default defineNuxtPlugin(() => {
  let eventSource: EventSource | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let isReconnecting = false;
  
  const setupSSE = (familyGroupId: number, handlers: SSEHandlers) => {
    if (import.meta.client) {
      // Close existing connection if any
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      
      // Clear any pending reconnection
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      eventSource = new EventSource(`/api/server-sent-events/${familyGroupId}`);
      
      eventSource.onopen = (_event: Event) => {
        isReconnecting = false;
      };
      
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Call the appropriate handler if it exists
          if (handlers[data.type]) {
            handlers[data.type](data.data);
          }
        } catch (error) {
          console.error('[SSE Plugin] Error parsing SSE message:', error, event.data);
        }
      };
      
      eventSource.onerror = (_event: Event) => {
        // EventSource readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
        const readyState = eventSource?.readyState;
        
        if (readyState === EventSource.CLOSED) {
          // Only reconnect if we're not already reconnecting
          if (!isReconnecting) {
            isReconnecting = true;
            eventSource?.close();
            eventSource = null;
            
            reconnectTimeout = setTimeout(() => {
              setupSSE(familyGroupId, handlers);
            }, 5000);
          }
        }
      };
    }
    
    return eventSource;
  };
  
  const closeSSE = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    isReconnecting = false;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
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
