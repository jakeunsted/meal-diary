import { addWebhookEvent } from '~/server/utils/shoppingListState';
import { SSE_EMITTER } from '~/server/api/server-sent-events/[family_group_id].get';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  if (!familyGroupId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Family group ID is required',
    });
  }

  const body = await readBody(event);
  
  // Store the event
  addWebhookEvent(Number(familyGroupId), body.eventType, {
    categoryName: body.categoryName,
    categoryContents: body.categoryContents
  });
  
  // Emit the event to all connected clients
  SSE_EMITTER.emit(`family-${familyGroupId}`, body.eventType, {
    categoryName: body.categoryName,
    categoryContents: body.categoryContents
  });

  return { success: true };
});
