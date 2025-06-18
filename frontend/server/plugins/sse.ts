import { EventEmitter } from 'events';

// Create a global event emitter for SSE
const SSE_EMITTER = new EventEmitter();
SSE_EMITTER.setMaxListeners(100); // max 100 listeners

// Extend globalThis type
declare global {
  var SSE_EMITTER: EventEmitter;
}

export default defineNitroPlugin(() => {
  // Make the emitter available globally
  globalThis.SSE_EMITTER = SSE_EMITTER;
});

// Export the emitter for direct imports
export { SSE_EMITTER }; 