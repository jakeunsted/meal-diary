import { describe, expect, it, vi } from 'vitest';
import { useMobileInputScroll } from './useMobileInputScroll';

describe('useMobileInputScroll', () => {
  it('scrolls the nearest parent when the visible viewport covers an input', () => {
    const parent = { scrollTop: 0, parentElement: null as HTMLElement | null };
    const element = {
      parentElement: parent,
      getBoundingClientRect: () => ({ top: 20, bottom: 500 }),
      scrollIntoView: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const viewport = {
      offsetTop: 40,
      height: 300,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('window', {
      visualViewport: viewport,
      getComputedStyle: () => ({ overflow: 'auto', overflowY: '', overflowX: '' }),
      scrollBy: vi.fn(),
    });

    useMobileInputScroll().scrollToInput(element as unknown as HTMLElement);

    expect(parent.scrollTop).toBe(500 - (40 + 300 - 16));
    expect(viewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(element.scrollIntoView).not.toHaveBeenCalled();
  });

  it('falls back to scrollIntoView when visualViewport is missing', () => {
    const element = {
      parentElement: null,
      getBoundingClientRect: () => ({ top: 0, bottom: 10 }),
      scrollIntoView: vi.fn(),
    };
    vi.stubGlobal('window', {
      visualViewport: null,
      getComputedStyle: () => ({ overflow: '', overflowY: '', overflowX: '' }),
      scrollBy: vi.fn(),
    });

    useMobileInputScroll().scrollToInput(element as unknown as HTMLElement);

    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });
});
