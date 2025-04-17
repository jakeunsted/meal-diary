import axios from 'axios';
import dotenv from 'dotenv';
import ShoppingListCategory from '../db/models/ShoppingList.model.ts';
import DailyMeal from '../db/models/DailyMeal.model.ts';

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

/**
 * Sends a webhook for a shopping list event
 * @param {number} familyGroupId - The ID of the family group
 * @param {string} categoryName - The name of the category
 * @param {ShoppingListCategory[]} categoryContents - The contents of the category
 * @param {string} eventType - The type of the event
 */
export const sendShoppingListWebhook = async (
  familyGroupId: number, 
  categoryName: string, 
  categoryContents: ShoppingListCategory[], 
  eventType: string
) => {
  try {
    const webHookUrl = `${WEBHOOK_BASE_URL}/${familyGroupId}/shopping-list`;

    await axios.post(webHookUrl, {
      eventType,
      familyGroupId,
      categoryName,
      categoryContents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending webhook: ', error);
  }
}

/**
 * Sends a webhook for a meal diary event
 * @param {number} familyGroupId - The ID of the family group
 * @param {string} eventType - The type of the event
 * @param {DailyMeal} dailyMeal - The daily meal object
 */
export const sendDailyMealWebhook = async (
  familyGroupId: number,
  eventType: string,
  dailyMeal: DailyMeal
) => {
  try {
    const webHookUrl = `${WEBHOOK_BASE_URL}/${familyGroupId}/daily-meal`;

    await axios.post(webHookUrl, {
      eventType,
      familyGroupId,
      dailyMeal,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending webhook: ', error);
  }
}
