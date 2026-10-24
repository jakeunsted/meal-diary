import { afterEach, describe, expect, it, vi } from 'vitest';
import plugin from './sse';

class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: FakeEventSource[] = [];
  url = '';
  readyState = FakeEventSource.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
}

describe('sse plugin', () => {
  afterEach(() => {
    vi.useRealTimers();
    FakeEventSource.instances = [];
  });

  it('dispatches messages and reconnects after the stream closes', () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', FakeEventSource);
    globalThis.__NUXT_CLIENT__ = true;
    const sse = plugin({} as never).provide.sse;
    const onAdd = vi.fn();

    sse.setup(9, { 'add-item': onAdd });
    const stream = FakeEventSource.instances[0];
    expect(stream.url).toBe('/api/server-sent-events/9');

    stream.onmessage?.({ data: JSON.stringify({ type: 'add-item', data: { id: 1 } }) } as MessageEvent);
    expect(onAdd).toHaveBeenCalledWith({ id: 1 });

    stream.onmessage?.({ data: 'not-json' } as MessageEvent);
    stream.readyState = FakeEventSource.CLOSED;
    stream.onerror?.({} as Event);
    vi.advanceTimersByTime(5000);
    expect(FakeEventSource.instances).toHaveLength(2);

    sse.close();
    expect(FakeEventSource.instances[1].close).toHaveBeenCalled();
  });
});
