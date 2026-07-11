import type { Request, Response } from 'express';
import {
  getLatestFamilyEvents,
  subscribeFamilyEvents,
} from '../../services/sse.service.ts';

/**
 * Opens a family-scoped SSE stream for shopping list and meal diary events.
 */
export const subscribeFamilySse = (req: Request, res: Response): void => {
  const familyGroupId = parseInt(req.params.family_group_id, 10);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (eventType: string, data: unknown) => {
    if (res.writableEnded || res.destroyed) {
      return;
    }
    try {
      res.write(`data: ${JSON.stringify({ type: eventType, data })}\n\n`);
    } catch (error) {
      console.error('[SSE] Error sending event:', error);
    }
  };

  try {
    const latestEvents = getLatestFamilyEvents(familyGroupId);
    const shoppingList = latestEvents.filter((event) =>
      ['add-item', 'delete-item', 'check-item', 'uncheck-item', 'move-item'].includes(event.type)
    );
    const mealDiary = latestEvents.filter((event) => event.type === 'update-daily-meal');
    sendEvent('initial', { shoppingList, mealDiary });
  } catch (error) {
    console.error('[SSE] Error sending initial events:', error);
    sendEvent('error', { message: 'Failed to load initial data' });
  }

  const unsubscribe = subscribeFamilyEvents(familyGroupId, (eventType, data) => {
    sendEvent(eventType, data);
  });

  const pingInterval = setInterval(() => {
    sendEvent('ping', { timestamp: new Date().toISOString() });
  }, 30000);

  const cleanup = () => {
    clearInterval(pingInterval);
    unsubscribe();
  };

  req.on('close', cleanup);
  res.on('error', (error) => {
    console.error('[SSE] Response error:', error);
    cleanup();
  });
};
