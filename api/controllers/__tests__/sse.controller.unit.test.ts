import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const getLatestFamilyEvents = vi.fn();
const subscribeFamilyEvents = vi.fn();
const unsubscribe = vi.fn();
const findByPk = vi.fn();

vi.mock('../../services/sse.service.ts', () => ({
  getLatestFamilyEvents: (...args: unknown[]) => getLatestFamilyEvents(...args),
  subscribeFamilyEvents: (...args: unknown[]) => subscribeFamilyEvents(...args),
}));

vi.mock('../../db/models/User.model.ts', () => ({
  default: {
    findByPk: (...args: unknown[]) => findByPk(...args),
  },
}));

import { subscribeFamilySse } from '../sse/sse.controller.ts';

const member = { dataValues: { id: 5, family_group_id: 9 } };

const flush = async () => {
  for (let step = 0; step < 10; step += 1) {
    await Promise.resolve();
  }
};

describe('subscribeFamilySse', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sends the current shopping list and diary, then cleans up on close', async () => {
    vi.useFakeTimers();
    getLatestFamilyEvents.mockReturnValue([
      { type: 'add-item', data: { item: { id: 1 } } },
      { type: 'update-daily-meal', data: { dailyMeal: { day_of_week: 1 } } },
      { type: 'ping', data: {} },
    ]);
    subscribeFamilyEvents.mockReturnValue(unsubscribe);

    const listeners: Record<string, () => void> = {};
    const writes: string[] = [];
    findByPk.mockResolvedValue(member);
    const req = {
      params: { family_group_id: '9' },
      user: member,
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
      end: vi.fn(),
      writableEnded: false,
      destroyed: false,
      on: vi.fn(),
    } as unknown as Response;

    subscribeFamilySse(req, res);
    await flush();

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(JSON.parse(writes[0].replace(/^data: /, '').trim())).toEqual({
      type: 'initial',
      data: {
        shoppingList: [{ type: 'add-item', data: { item: { id: 1 } } }],
        mealDiary: [{ type: 'update-daily-meal', data: { dailyMeal: { day_of_week: 1 } } }],
      },
    });

    await vi.advanceTimersByTimeAsync(30000);
    await flush();
    expect(writes.some((chunk) => chunk.includes('"type":"ping"'))).toBe(true);

    listeners.close();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('sends an error event when the initial snapshot fails', async () => {
    vi.useFakeTimers();
    getLatestFamilyEvents.mockImplementation(() => {
      throw new Error('cache down');
    });
    subscribeFamilyEvents.mockReturnValue(unsubscribe);
    const listeners: Record<string, () => void> = {};
    const writes: string[] = [];
    findByPk.mockResolvedValue(member);
    const req = {
      params: { family_group_id: '9' },
      user: member,
      on: (event: string, handler: () => void) => {
        listeners[event] = handler;
      },
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => writes.push(chunk)),
      end: vi.fn(),
      writableEnded: false,
      destroyed: false,
      on: vi.fn(),
    } as unknown as Response;

    subscribeFamilySse(req, res);
    await flush();

    expect(writes[0]).toContain('"type":"error"');
    listeners.close();
  });

  it('stops the stream when the user has left the family', async () => {
    vi.useFakeTimers();
    getLatestFamilyEvents.mockReturnValue([]);
    let handler: ((eventType: string, data: unknown) => void) | undefined;
    subscribeFamilyEvents.mockImplementation((_id: number, next: (eventType: string, data: unknown) => void) => {
      handler = next;
      return unsubscribe;
    });
    findByPk.mockResolvedValue(member);
    const writes: string[] = [];
    const req = {
      params: { family_group_id: '9' },
      user: member,
      on: vi.fn(),
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => writes.push(chunk)),
      end: vi.fn(),
      writableEnded: false,
      destroyed: false,
      on: vi.fn(),
    } as unknown as Response;

    subscribeFamilySse(req, res);
    await flush();
    findByPk.mockResolvedValue({ dataValues: { id: 5, family_group_id: null } });
    handler?.('add-item', { item: { id: 2 } });
    await flush();

    expect(unsubscribe).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
    expect(writes.some((chunk) => chunk.includes('"id":2'))).toBe(false);
  });
});
