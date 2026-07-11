import { EventEmitter } from 'events';

export type FamilySseHandler = (eventType: string, data: unknown) => void;

const SSE_EMITTER = new EventEmitter();
SSE_EMITTER.setMaxListeners(100);

const MAX_BUFFERED_EVENTS = 100;
const eventBuffers = new Map<number, Array<{ type: string; data: unknown }>>();

function channelName(familyGroupId: number): string {
  return `family-${familyGroupId}`;
}

function pushBufferedEvent(familyGroupId: number, eventType: string, data: unknown): void {
  const existing = eventBuffers.get(familyGroupId) ?? [];
  existing.push({ type: eventType, data });
  if (existing.length > MAX_BUFFERED_EVENTS) {
    existing.splice(0, existing.length - MAX_BUFFERED_EVENTS);
  }
  eventBuffers.set(familyGroupId, existing);
}

export function emitFamilyEvent(
  familyGroupId: number,
  eventType: string,
  data: unknown
): void {
  pushBufferedEvent(familyGroupId, eventType, data);
  SSE_EMITTER.emit(channelName(familyGroupId), eventType, data);
}

export function subscribeFamilyEvents(
  familyGroupId: number,
  handler: FamilySseHandler
): () => void {
  const channel = channelName(familyGroupId);
  SSE_EMITTER.on(channel, handler);
  return () => {
    SSE_EMITTER.off(channel, handler);
  };
}

export function getLatestFamilyEvents(familyGroupId: number): Array<{ type: string; data: unknown }> {
  return [...(eventBuffers.get(familyGroupId) ?? [])];
}
