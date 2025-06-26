import { SSE_EMITTER } from '~/server/plugins/sse';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  if (!familyGroupId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Family group ID is required',
    });
  }

  const body = await readBody(event);

  console.log('got category webhook:', body.category);
  
  // Only emit the event to connected clients
  SSE_EMITTER.emit(`family-${familyGroupId}`, body.eventType, {
    category: body.category
  });

  return { success: true };
}); 