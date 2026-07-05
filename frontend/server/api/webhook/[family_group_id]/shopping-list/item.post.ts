import { SSE_EMITTER } from '~/server/plugins/sse';
import { shoppingListEventStore } from '~/server/utils/eventStore';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  if (!familyGroupId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Family group ID is required',
    });
  }

  const body = await readBody(event);

  console.log('got item webhook:', body.eventType);

  // Only emit the event to connected clients
  SSE_EMITTER.emit(`family-${familyGroupId}`, body.eventType, {
    item: body.item,
    actorUserId: body.actorUserId ?? null
  });

  // Record the event for new SSE subscribers
  shoppingListEventStore.addEvent(Number(familyGroupId), body.eventType, {
    item: body.item,
    actorUserId: body.actorUserId ?? null
  });

  return { success: true };
});
