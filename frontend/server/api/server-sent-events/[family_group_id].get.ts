import { getLatestEvents, addWebhookEvent } from '~/server/utils/shoppingListState';
import { EventEmitter } from 'events';

// Create a global event emitter for SSE
const SSE_EMITTER = new EventEmitter();
SSE_EMITTER.setMaxListeners(100); // max 100 listeners

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  if (!familyGroupId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Family group ID is required',
    });
  }
  
  const response = event.node.res;
  
  // Set headers for SSE
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Send initial data
  const initialEvents = getLatestEvents(Number(familyGroupId));
  response.write(`data: ${JSON.stringify({ type: 'initial', data: initialEvents })}\n\n`);
  
  // Function to send new events
  const sendEvent = (eventType: string, data: any) => {
    response.write(`data: ${JSON.stringify({ type: eventType, data })}\n\n`);
  };
  
  // Listen for events for this family group
  const eventHandler = (eventType: string, data: any) => {
    sendEvent(eventType, data);
  };
  
  const channelName = `family-${familyGroupId}`;
  SSE_EMITTER.on(channelName, eventHandler);
  
  // Handle client disconnect
  response.on('close', () => {
    SSE_EMITTER.off(channelName, eventHandler);
  });
  
  // Keep connection alive with ping events
  const pingInterval = setInterval(() => {
    sendEvent('ping', { timestamp: new Date().toISOString() });
  }, 30000);
  
  // Clean up interval on close
  response.on('close', () => {
    clearInterval(pingInterval);
  });
});

// Export the emitter so webhook handler can use it
export { SSE_EMITTER };
