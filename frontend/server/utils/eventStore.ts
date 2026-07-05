interface StoredEvent {
  type: string;
  data: any;
}

interface EventWithId extends StoredEvent {
  id: number;
}

/**
 * Creates an in-memory event store keyed by family group ID.
 * Keeps only the most recent 100 events per family group.
 */
export const createEventStore = () => {
  const events = new Map<number, StoredEvent[]>();

  /**
   * Adds a new event for a given family group.
   * @param {number} familyGroupId - The ID of the family group.
   * @param {string} eventType - The type of the event.
   * @param {any} data - The data associated with the event.
   */
  const addEvent = (familyGroupId: number, eventType: string, data: any) => {
    if (!events.has(familyGroupId)) {
      events.set(familyGroupId, []);
    }

    const groupEvents = events.get(familyGroupId)!;
    groupEvents.push({ type: eventType, data });

    // Keep only the most recent 100 events
    while (groupEvents.length > 100) {
      groupEvents.shift();
    }
  };

  /**
   * Retrieves the latest events for a given family group.
   * @param {number} familyGroupId - The ID of the family group.
   * @param {number} [lastEventId] - The ID of the last event received. If provided, only events after this ID will be returned.
   * @returns {EventWithId[]} - An array of events with their IDs, types, and data.
   */
  const getLatestEvents = (familyGroupId: number, lastEventId?: number): EventWithId[] => {
    const groupEvents = events.get(familyGroupId) || [];

    // Convert to array with IDs
    const eventsWithIds = groupEvents.map((event, index) => ({
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

  return { addEvent, getLatestEvents };
};

export const shoppingListEventStore = createEventStore();
export const mealDiaryEventStore = createEventStore();
