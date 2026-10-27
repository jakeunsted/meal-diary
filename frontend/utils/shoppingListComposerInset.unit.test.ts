import { describe, expect, it } from 'vitest';

import {
  SHOPPING_LIST_DOCK_OFFSET_PX,
  shoppingListComposerBottomPx,
} from './shoppingListComposerInset';

describe('shoppingListComposerBottomPx', () => {
  it('sits above the dock when the keyboard is closed', () => {
    expect(
      shoppingListComposerBottomPx({
        windowInnerHeight: 800,
        viewportHeight: 800,
        viewportOffsetTop: 0,
      })
    ).toBe(SHOPPING_LIST_DOCK_OFFSET_PX);
  });

  it('ignores browser chrome shorter than the dock', () => {
    expect(
      shoppingListComposerBottomPx({
        windowInnerHeight: 800,
        viewportHeight: 760,
        viewportOffsetTop: 0,
      })
    ).toBe(SHOPPING_LIST_DOCK_OFFSET_PX);
  });

  it('sits on the keyboard when the visual viewport shrinks', () => {
    expect(
      shoppingListComposerBottomPx({
        windowInnerHeight: 800,
        viewportHeight: 420,
        viewportOffsetTop: 0,
      })
    ).toBe(380);
  });

  it('includes a visual viewport offset when the page is scrolled', () => {
    expect(
      shoppingListComposerBottomPx({
        windowInnerHeight: 800,
        viewportHeight: 430,
        viewportOffsetTop: 20,
      })
    ).toBe(350);
  });
});
