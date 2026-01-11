import { getLatestEvents } from '~/server/utils/shoppingListState';
import { getLatestMealDiaryEvents } from '~/server/utils/mealDiaryState';
import { SSE_EMITTER } from '~/server/plugins/sse';

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
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Function to send new events with error handling
  const sendEvent = (eventType: string, data: any) => {
    try {
      if (!response.writableEnded && !response.destroyed) {
        response.write(`data: ${JSON.stringify({ type: eventType, data })}\n\n`);
      }
    } catch (error) {
      console.error('[SSE Server] Error sending event:', error);
    }
  };
  
  // Send initial data with error handling
  try {
    const initialShoppingEvents = getLatestEvents(Number(familyGroupId));
    const initialMealDiaryEvents = getLatestMealDiaryEvents(Number(familyGroupId));
    
    const initialData = { 
      type: 'initial', 
      data: {
        shoppingList: initialShoppingEvents,
        mealDiary: initialMealDiaryEvents
      }
    };
    
    response.write(`data: ${JSON.stringify(initialData)}\n\n`);
  } catch (error) {
    console.error('[SSE Server] Error getting initial events:', error);
    response.write(`data: ${JSON.stringify({ type: 'error', data: { message: 'Failed to load initial data' } })}\n\n`);
  }
  
  // Listen for events for this family group
  const eventHandler = (eventType: string, data: any) => {
    sendEvent(eventType, data);
  };
  
  const channelName = `family-${familyGroupId}`;
  SSE_EMITTER.on(channelName, eventHandler);
  
  // Keep connection alive with ping events
  const pingInterval = setInterval(() => {
    sendEvent('ping', { timestamp: new Date().toISOString() });
  }, 30000);
  
  // Handle client disconnect
  const cleanup = () => {
    clearInterval(pingInterval);
    SSE_EMITTER.off(channelName, eventHandler);
  };
  
  response.on('close', cleanup);
  response.on('finish', cleanup);
  
  // Handle errors
  response.on('error', (error) => {
    console.error('[SSE Server] Response error:', error);
    cleanup();
  });
  
  // Prevent the handler from returning a response (SSE is streamed)
  return new Promise(() => {
    // Keep the connection open
  });
});
