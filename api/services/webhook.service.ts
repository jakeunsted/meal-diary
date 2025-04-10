import axios from 'axios';
import dotenv from 'dotenv';
import ShoppingListCategory from '../db/models/ShoppingList.model.ts';

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
