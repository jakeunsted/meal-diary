import { shoppingListEventStore, mealDiaryEventStore } from '~/server/utils/eventStore';
import { SSE_EMITTER } from '~/server/plugins/sse';
import { apiFetch } from '~/server/utils/fetch';
import { resolveFamilyStreamAccess } from '~/server/utils/familyStreamAuth';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  if (!familyGroupId || !/^\d+$/.test(familyGroupId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Family group ID is required',
    });
  }

  const familyId = Number(familyGroupId);
  const authorization = getHeader(event, 'authorization');
  const loadUser = (userId: number) => apiFetch<{ family_group_id?: number | null }>(`/users/${userId}`, {}, event);

  const access = await resolveFamilyStreamAccess(authorization, familyId, loadUser);
  if (access !== 'ok') {
    throw createError({
      statusCode: access === 'unauthorized' ? 401 : 403,
      statusMessage: access === 'unauthorized' ? 'Unauthorized' : 'Forbidden',
    });
  }

  const response = event.node.res;

  // Set headers for SSE
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  let closed = false;

  const cleanup = () => {
    if (closed) {
      return;
    }
    closed = true;
    clearInterval(pingInterval);
    SSE_EMITTER.off(channelName, eventHandler);
    if (!response.writableEnded) {
      response.end();
    }
  };

  // Function to send new events with error handling
  const sendEvent = (eventType: string, data: any) => {
    try {
      if (!closed && !response.writableEnded && !response.destroyed) {
        response.write(`data: ${JSON.stringify({ type: eventType, data })}\n\n`);
      }
    } catch (error) {
      console.error('[SSE Server] Error sending event:', error);
    }
  };

  const deliver = (eventType: string, data: any) => {
    void resolveFamilyStreamAccess(authorization, familyId, loadUser)
      .then((decision) => {
        if (decision !== 'ok') {
          cleanup();
          return;
        }
        sendEvent(eventType, data);
      })
      .catch((error) => {
        console.error('[SSE Server] Membership check failed:', error);
        cleanup();
      });
  };

  // Send initial data with error handling
  try {
    const initialShoppingEvents = shoppingListEventStore.getLatestEvents(familyId);
    const initialMealDiaryEvents = mealDiaryEventStore.getLatestEvents(familyId);

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
    deliver(eventType, data);
  };

  const channelName = `family-${familyGroupId}`;
  SSE_EMITTER.on(channelName, eventHandler);

  // Keep connection alive with ping events
  const pingInterval = setInterval(() => {
    sendEvent('ping', { timestamp: new Date().toISOString() });
  }, 30000);

  // Handle client disconnect
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
