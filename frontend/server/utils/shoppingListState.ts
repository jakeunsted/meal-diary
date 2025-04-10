const webhookEvents = new Map<number, { type: string; data: any }[]>();

export const addWebhookEvent = (familyGroupId: number, eventType: string, data: any) => {
  if (!webhookEvents.has(familyGroupId)) {
    webhookEvents.set(familyGroupId, []);
  }
  
  const events = webhookEvents.get(familyGroupId)!;
  events.push({ type: eventType, data });
  
  // Keep only the most recent 100 events
  while (events.length > 100) {
    events.shift();
  }
};

export const getLatestEvents = (familyGroupId: number, lastEventId?: number): { id: number; type: string; data: any }[] => {
  const events = webhookEvents.get(familyGroupId) || [];
  
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
