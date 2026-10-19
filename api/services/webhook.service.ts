import dotenv from 'dotenv';
import ShoppingListItem from '../db/models/ShoppingListItem.model.ts';
import { emitFamilyEvent } from './sse.service.ts';
import type { DayMealSlotDto } from './mealSlots.service.ts';

dotenv.config({ quiet: true });

const NODE_ENV = process.env.NODE_ENV;
let WEBHOOK_BASE_URL: string | undefined;
if (NODE_ENV === 'production') {
  WEBHOOK_BASE_URL = process.env.PROD_WEBHOOK_BASE_URL;
} else {
  WEBHOOK_BASE_URL = process.env.DEV_WEBHOOK_BASE_URL;
}

if (!WEBHOOK_BASE_URL) {
  throw new Error('WEBHOOK_BASE_URL is not defined');
}

interface DailyMealWebhookSource {
  dataValues: {
    day_of_week: number;
    breakfast?: string | null;
    lunch?: string | null;
    dinner?: string | null;
    breakfast_recipe_id?: number | null;
    lunch_recipe_id?: number | null;
    dinner_recipe_id?: number | null;
  };
}

interface DailyMealPayload {
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  breakfast_recipe_id: number | null;
  lunch_recipe_id: number | null;
  dinner_recipe_id: number | null;
  week_start_date?: string;
  slots?: DayMealSlotDto[];
}

function toPlainItem(item: ShoppingListItem): Record<string, unknown> {
  if (typeof item.toJSON === 'function') {
    return item.toJSON() as unknown as Record<string, unknown>;
  }
  return item as unknown as Record<string, unknown>;
}

/**
 * Sends a webhook for a meal diary event
 * @param {number} familyGroupId - The ID of the family group
 * @param {string} eventType - The type of the event
 * @param {DailyMealWebhookSource} dailyMeal - The daily meal, or the same day fields
 * @param {string} [weekStartDate] - ISO week start date for clients that cache by week
 * @param {DayMealSlotDto[]} [slots] - That day's slots. Omit to leave the existing payload unchanged.
 */
export const sendDailyMealWebhook = async (
  familyGroupId: number,
  eventType: string,
  dailyMeal: DailyMealWebhookSource,
  weekStartDate?: string,
  slots?: DayMealSlotDto[]
) => {
  try {
    const webHookUrl = `${WEBHOOK_BASE_URL}/${familyGroupId}/daily-meal`;

    const payload: DailyMealPayload = {
      day_of_week: dailyMeal.dataValues.day_of_week,
      breakfast: dailyMeal.dataValues.breakfast ?? null,
      lunch: dailyMeal.dataValues.lunch ?? null,
      dinner: dailyMeal.dataValues.dinner ?? null,
      breakfast_recipe_id: dailyMeal.dataValues.breakfast_recipe_id ?? null,
      lunch_recipe_id: dailyMeal.dataValues.lunch_recipe_id ?? null,
      dinner_recipe_id: dailyMeal.dataValues.dinner_recipe_id ?? null,
      ...(weekStartDate ? { week_start_date: weekStartDate } : {}),
      ...(slots !== undefined ? { slots } : {}),
    };

    const eventData = { dailyMeal: payload };
    emitFamilyEvent(familyGroupId, eventType, eventData);

    const response = await fetch(webHookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        familyGroupId,
        dailyMeal: payload,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      console.error('Error sending webhook: ', `${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error sending webhook: ', error);
  }
}

/**
 * Sends a webhook for a shopping list item event
 * @param {number} familyGroupId - The ID of the family group
 * @param {string} eventType - The type of the event (add-item, check-item, uncheck-item, move-item, delete-item)
 * @param {ShoppingListItem} item - The shopping list item
 * @param {number} [actorUserId] - The id of the user who triggered the event, so
 *   connected clients can ignore their own echoed changes
 */
export const sendShoppingListItemWebhook = async (
  familyGroupId: number,
  eventType: string,
  item: ShoppingListItem,
  actorUserId?: number
) => {
  try {
    const webHookUrl = `${WEBHOOK_BASE_URL}/${familyGroupId}/shopping-list/item`;
    const plainItem = toPlainItem(item);
    const eventData = {
      item: plainItem,
      actorUserId: actorUserId ?? null,
    };

    emitFamilyEvent(familyGroupId, eventType, eventData);

    const response = await fetch(webHookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        familyGroupId,
        item: plainItem,
        actorUserId: actorUserId ?? null,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      console.error('Error sending webhook: ', `${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error sending webhook: ', error);
  }
}
