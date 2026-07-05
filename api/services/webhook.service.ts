import dotenv from 'dotenv';
import DailyMeal from '../db/models/DailyMeal.model.ts';
import ShoppingListItem from '../db/models/ShoppingListItem.model.ts';

dotenv.config();

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

interface DailyMealPayload {
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  breakfast_recipe_id: number | null;
  lunch_recipe_id: number | null;
  dinner_recipe_id: number | null;
}

/**
 * Sends a webhook for a meal diary event
 * @param {number} familyGroupId - The ID of the family group
 * @param {string} eventType - The type of the event
 * @param {DailyMeal} dailyMeal - The daily meal model instance
 */
export const sendDailyMealWebhook = async (
  familyGroupId: number,
  eventType: string,
  dailyMeal: DailyMeal
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
    };

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

    const response = await fetch(webHookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        familyGroupId,
        item,
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
