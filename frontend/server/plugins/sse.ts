import { EventEmitter } from 'events';

const SSE_EMITTER = new EventEmitter();
SSE_EMITTER.setMaxListeners(100); // max 100 listeners

declare global {
  var SSE_EMITTER: EventEmitter;
}

export default defineNitroPlugin(() => {
  globalThis.SSE_EMITTER = SSE_EMITTER;
});

export { SSE_EMITTER };
