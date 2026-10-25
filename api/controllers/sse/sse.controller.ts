import type { Request, Response } from 'express';
import {
  getLatestFamilyEvents,
  subscribeFamilyEvents,
} from '../../services/sse.service.ts';
import User from '../../db/models/User.model.ts';
import { routeParamInt } from '../../utils/routeParam.ts';

/**
 * Opens a family-scoped SSE stream for shopping list and meal diary events.
 * Membership is checked again before every send so a member who leaves
 * stops receiving events on a connection that stayed open.
 */
export const subscribeFamilySse = (req: Request, res: Response): void => {
  const familyGroupId = routeParamInt(req.params.family_group_id);
  const userId = (req.user as User | undefined)?.dataValues.id;

  if (!userId) {
    res.status(401).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  let pingInterval: ReturnType<typeof setInterval> | undefined;
  let unsubscribe = () => {};

  const cleanup = () => {
    if (closed) {
      return;
    }
    closed = true;
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    unsubscribe();
    if (!res.writableEnded) {
      res.end();
    }
  };

  const writeEvent = (eventType: string, data: unknown) => {
    if (closed || res.writableEnded || res.destroyed) {
      return;
    }
    try {
      res.write(`data: ${JSON.stringify({ type: eventType, data })}\n\n`);
    } catch (error) {
      console.error('[SSE] Error sending event:', error);
    }
  };

  const deliver = (eventType: string, data: unknown) => {
    void User.findByPk(userId)
      .then((current) => {
        if (current?.dataValues.family_group_id !== familyGroupId) {
          cleanup();
          return;
        }
        writeEvent(eventType, data);
      })
      .catch((error) => {
        console.error('[SSE] Membership check failed:', error);
        cleanup();
      });
  };

  try {
    const latestEvents = getLatestFamilyEvents(familyGroupId);
    const shoppingList = latestEvents.filter((event) =>
      ['add-item', 'delete-item', 'check-item', 'uncheck-item', 'move-item'].includes(event.type)
    );
    const mealDiary = latestEvents.filter((event) => event.type === 'update-daily-meal');
    deliver('initial', { shoppingList, mealDiary });
  } catch (error) {
    console.error('[SSE] Error sending initial events:', error);
    deliver('error', { message: 'Failed to load initial data' });
  }

  unsubscribe = subscribeFamilyEvents(familyGroupId, (eventType, data) => {
    deliver(eventType, data);
  });

  pingInterval = setInterval(() => {
    deliver('ping', { timestamp: new Date().toISOString() });
  }, 30000);

  req.on('close', cleanup);
  res.on('error', (error) => {
    console.error('[SSE] Response error:', error);
    cleanup();
  });
};
