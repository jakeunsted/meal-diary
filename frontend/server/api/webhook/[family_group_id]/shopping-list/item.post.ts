import { SSE_EMITTER } from '~/server/plugins/sse';
import { shoppingListEventStore } from '~/server/utils/eventStore';
import { SHOPPING_LIST_WEBHOOK_EVENTS, webhookSecretsMatch } from '~/server/utils/webhookAuth';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  if (!familyGroupId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Family group ID is required',
    });
  }

  const config = useRuntimeConfig();
  const providedSecret = getHeader(event, 'x-webhook-secret');
  if (!webhookSecretsMatch(config.webhookSharedSecret, providedSecret)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const body = await readBody(event);
  if (!SHOPPING_LIST_WEBHOOK_EVENTS.has(body?.eventType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported event type',
    });
  }

  const payload = {
    item: body.item,
    actorUserId: body.actorUserId ?? null
  };

  // Only emit the event to connected clients
  SSE_EMITTER.emit(`family-${familyGroupId}`, body.eventType, payload);

  // Record the event for new SSE subscribers
  shoppingListEventStore.addEvent(Number(familyGroupId), body.eventType, payload);

  return { success: true };
});
