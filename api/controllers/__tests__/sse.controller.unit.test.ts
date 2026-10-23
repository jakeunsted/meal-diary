import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const getLatestFamilyEvents = vi.fn();
const subscribeFamilyEvents = vi.fn();
const unsubscribe = vi.fn();

vi.mock('../../services/sse.service.ts', () => ({
  getLatestFamilyEvents: (...args: unknown[]) => getLatestFamilyEvents(...args),
  subscribeFamilyEvents: (...args: unknown[]) => subscribeFamilyEvents(...args),
}));

import { subscribeFamilySse } from '../sse/sse.controller.ts';

describe('subscribeFamilySse', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sends the current shopping list and diary, then cleans up on close', () => {
    vi.useFakeTimers();
    getLatestFamilyEvents.mockReturnValue([
      { type: 'add-item', data: { item: { id: 1 } } },
      { type: 'update-daily-meal', data: { dailyMeal: { day_of_week: 1 } } },
      { type: 'ping', data: {} },
    ]);
    subscribeFamilyEvents.mockReturnValue(unsubscribe);

    const listeners: Record<string, () => void> = {};
    const writes: string[] = [];
    const req = {
      params: { family_group_id: '9' },
      on: (event: string, handler: () => void) => {
        listeners[event] = handler;
      },
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => {
        writes.push(chunk);
      }),
      writableEnded: false,
      destroyed: false,
      on: vi.fn(),
    } as unknown as Response;

    subscribeFamilySse(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(JSON.parse(writes[0].replace(/^data: /, '').trim())).toEqual({
      type: 'initial',
      data: {
        shoppingList: [{ type: 'add-item', data: { item: { id: 1 } } }],
        mealDiary: [{ type: 'update-daily-meal', data: { dailyMeal: { day_of_week: 1 } } }],
      },
    });

    vi.advanceTimersByTime(30000);
    expect(writes.some((chunk) => chunk.includes('"type":"ping"'))).toBe(true);

    listeners.close();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('sends an error event when the initial snapshot fails', () => {
    vi.useFakeTimers();
    getLatestFamilyEvents.mockImplementation(() => {
      throw new Error('cache down');
    });
    subscribeFamilyEvents.mockReturnValue(unsubscribe);
    const listeners: Record<string, () => void> = {};
    const writes: string[] = [];
    const req = {
      params: { family_group_id: '9' },
      on: (event: string, handler: () => void) => {
        listeners[event] = handler;
      },
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => writes.push(chunk)),
      writableEnded: false,
      destroyed: false,
      on: vi.fn(),
    } as unknown as Response;

    subscribeFamilySse(req, res);

    expect(writes[0]).toContain('"type":"error"');
    listeners.close();
  });
});
