const PADDING = 16;

function findScrollableParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;

  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflow = style.overflow + style.overflowY + style.overflowX;

    if (overflow.includes('scroll') || overflow.includes('auto')) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
}

function scrollByOverflow(element: HTMLElement, top: number) {
  const scrollableParent = findScrollableParent(element);
  if (scrollableParent) {
    scrollableParent.scrollTop += top;
    return;
  }

  window.scrollBy({ top, behavior: 'smooth' });
}

export const useMobileInputScroll = () => {
  let stopListening: (() => void) | null = null;

  const alignToVisibleViewport = (element: HTMLElement) => {
    const viewport = window.visualViewport;
    if (!viewport) {
      element.scrollIntoView({ block: 'center' });
      return;
    }

    const rect = element.getBoundingClientRect();
    const visibleTop = viewport.offsetTop;
    const visibleBottom = viewport.offsetTop + viewport.height;

    if (rect.bottom > visibleBottom - PADDING) {
      scrollByOverflow(element, rect.bottom - (visibleBottom - PADDING));
    } else if (rect.top < visibleTop + PADDING) {
      scrollByOverflow(element, rect.top - (visibleTop + PADDING));
    }
  };

  const scrollToInput = (element: HTMLElement | null) => {
    stopListening?.();
    stopListening = null;
    if (!element) return;

    alignToVisibleViewport(element);

    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => alignToVisibleViewport(element);
    const stop = () => {
      viewport.removeEventListener('resize', handleResize);
      element.removeEventListener('blur', stop);
      if (stopListening === stop) stopListening = null;
    };

    viewport.addEventListener('resize', handleResize);
    element.addEventListener('blur', stop);
    stopListening = stop;
  };

  return { scrollToInput };
};
