import { addMealDiaryEvent } from '../../../utils/mealDiaryState';
import { SSE_EMITTER } from '../../../plugins/sse';

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
  addMealDiaryEvent(Number(familyGroupId), body.eventType, {
    dailyMeal: body.dailyMeal
  });
  
  // Emit the event to all connected clients
  SSE_EMITTER.emit(`family-${familyGroupId}`, body.eventType, {
    dailyMeal: body.dailyMeal
  });

  return { success: true };
});
