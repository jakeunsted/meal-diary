import { defineNuxtPlugin } from '#app'

interface SSEHandlers {
  [key: string]: (data: any) => void;
}

export default defineNuxtPlugin(() => {
  let eventSource: EventSource | null = null;
  
  const setupSSE = (familyGroupId: number, handlers: SSEHandlers) => {
    if (import.meta.client) {
      eventSource = new EventSource(`/api/server-sent-events/${familyGroupId}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('SSE received:', data);
        
        // Call the appropriate handler if it exists
        if (data.type === 'delete-category' && handlers['delete-category']) {
          handlers['delete-category']({ categoryName: data.data.categoryName });
        } else if (handlers[data.type]) {
          handlers[data.type](data.data);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        eventSource?.close();
        // Try to reconnect after a delay
        setTimeout(() => setupSSE(familyGroupId, handlers), 5000);
      };
    }
    
    return eventSource;
  };
  
  const closeSSE = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
  
  return {
    provide: {
      sse: {
        setup: setupSSE,
        close: closeSSE,
      }
    }
  }
})
