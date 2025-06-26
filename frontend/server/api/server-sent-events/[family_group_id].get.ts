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
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Send initial data
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
