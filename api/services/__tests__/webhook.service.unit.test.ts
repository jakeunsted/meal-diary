import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.DEV_WEBHOOK_BASE_URL = 'http://nuxt.test/api/webhook';
  process.env.PROD_WEBHOOK_BASE_URL = 'http://nuxt.test/api/webhook';
  process.env.WEBHOOK_SHARED_SECRET = 'local-secret';
});

vi.mock('../sse.service.ts', () => ({
  emitFamilyEvent: vi.fn(),
}));

vi.mock('../../db/models/ShoppingListItem.model.ts', () => ({
  default: class ShoppingListItem {},
}));

import { sendDailyMealWebhook, sendShoppingListItemWebhook } from '../webhook.service.ts';

const fetchMock = vi.fn();

describe('family webhooks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    vi.stubGlobal('fetch', fetchMock);
    process.env.WEBHOOK_SHARED_SECRET = 'local-secret';
  });

  it('sends the shared secret with a meal update', async () => {
    await sendDailyMealWebhook(9, 'update-daily-meal', {
      dataValues: {
        day_of_week: 1,
        breakfast: 'Oats',
        lunch: null,
        dinner: null,
        breakfast_recipe_id: null,
        lunch_recipe_id: null,
        dinner_recipe_id: null,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('http://nuxt.test/api/webhook/9/daily-meal', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-webhook-secret': 'local-secret' }),
    }));
  });

  it('does not call the family channel when the shared secret is missing', async () => {
    delete process.env.WEBHOOK_SHARED_SECRET;
    await sendShoppingListItemWebhook(9, 'add-item', { toJSON: () => ({ id: 1 }) } as never, 4);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
