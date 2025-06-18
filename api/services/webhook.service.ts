import axios from 'axios';
import dotenv from 'dotenv';
import DailyMeal from '../db/models/DailyMeal.model.ts';
import ShoppingListCategory from '../db/models/ShoppingListCategory.model.ts';
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

/**
 * Sends a webhook for a shopping list item event
 * @param {number} familyGroupId - The ID of the family group
 * @param {string} eventType - The type of the event (add-item, check-item, uncheck-item, delete-item)
 * @param {ShoppingListItem} item - The shopping list item
 * @param {ShoppingListCategory} category - The category the item belongs to
 */
export const sendShoppingListItemWebhook = async (
  familyGroupId: number,
  eventType: string,
  item: ShoppingListItem,
  category: ShoppingListCategory
) => {
  try {
    const webHookUrl = `${WEBHOOK_BASE_URL}/${familyGroupId}/shopping-list/item`;

    await axios.post(webHookUrl, {
      eventType,
      familyGroupId,
      item,
      category,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending webhook: ', error);
  }
}

/**
 * Sends a webhook for a shopping list category event
 * @param {number} familyGroupId - The ID of the family group
 * @param {string} eventType - The type of the event (add-category, delete-category)
 * @param {ShoppingListCategory} category - The shopping list category
 */
export const sendShoppingListCategoryWebhook = async (
  familyGroupId: number,
  eventType: string,
  category: ShoppingListCategory
) => {
  try {
    const webHookUrl = `${WEBHOOK_BASE_URL}/${familyGroupId}/shopping-list/category`;

    await axios.post(webHookUrl, {
      eventType,
      familyGroupId,
      category,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending webhook: ', error);
  }
}
