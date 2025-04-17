const mealDiaryEvents = new Map<number, { type: string; data: any }[]>();

/**
 * Adds a new event to the meal diary for a given family group.
 * @param {number} familyGroupId - The ID of the family group.
 * @param {string} eventType - The type of the event.
 * @param {any} data - The data associated with the event.
 */
export const addMealDiaryEvent = (familyGroupId: number, eventType: string, data: any) => {
  if (!mealDiaryEvents.has(familyGroupId)) {
    mealDiaryEvents.set(familyGroupId, []);
  }
  
  const events = mealDiaryEvents.get(familyGroupId)!;
  events.push({ type: eventType, data });
  
  // Keep only the most recent 100 events
  while (events.length > 100) {
    events.shift();
  }
};

/**
 * Retrieves the latest meal diary events for a given family group.
 * @param {number} familyGroupId - The ID of the family group.
 * @param {number} [lastEventId] - The ID of the last event received. If provided, only events after this ID will be returned.
 * @returns {{ id: number; type: string; data: any }[]} - An array of events with their IDs, types, and data.
 */
export const getLatestMealDiaryEvents = (familyGroupId: number, lastEventId?: number): { id: number; type: string; data: any }[] => {
  const events = mealDiaryEvents.get(familyGroupId) || [];
  
  // Convert to array with IDs
  const eventsWithIds = events.map((event, index) => ({
    id: index,
    type: event.type,
    data: event.data
  }));
  
  // Filter events after lastEventId if provided
  if (lastEventId !== undefined) {
    return eventsWithIds.filter(event => event.id > lastEventId);
  }
  
  return eventsWithIds;
}; 