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

  // Only emit the event to connected clients
  SSE_EMITTER.emit(`family-${familyGroupId}`, body.eventType, {
    type: body.eventType,
    item: body.item,
    category: body.category
  });

  return { success: true };
}); 