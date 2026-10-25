import { mealDiaryEventStore } from '~/server/utils/eventStore';
import { SSE_EMITTER } from '~/server/plugins/sse';
import { DAILY_MEAL_WEBHOOK_EVENTS, webhookSecretsMatch } from '~/server/utils/webhookAuth';

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
  if (!DAILY_MEAL_WEBHOOK_EVENTS.has(body?.eventType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported event type',
    });
  }

  // Store the event
  mealDiaryEventStore.addEvent(Number(familyGroupId), body.eventType, {
    dailyMeal: body.dailyMeal
  });

  // Emit the event to all connected clients
  SSE_EMITTER.emit(`family-${familyGroupId}`, body.eventType, {
    dailyMeal: body.dailyMeal
  });

  return { success: true };
});
