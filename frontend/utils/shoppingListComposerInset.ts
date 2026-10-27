/** Matches `pb-20` on the default layout, which clears the bottom dock. */
export const SHOPPING_LIST_DOCK_OFFSET_PX = 80;

/**
 * Distance from the layout viewport's bottom edge to the add-item bar.
 * A software keyboard shrinks the visual viewport; the bar then sits on that
 * keyboard. Smaller differences (browser chrome) keep the bar above the dock.
 */
export function shoppingListComposerBottomPx(input: {
  windowInnerHeight: number;
  viewportHeight: number;
  viewportOffsetTop: number;
  dockOffsetPx?: number;
}): number {
  const dockOffsetPx = input.dockOffsetPx ?? SHOPPING_LIST_DOCK_OFFSET_PX;
  const keyboardCover = Math.max(
    0,
    input.windowInnerHeight - input.viewportHeight - input.viewportOffsetTop
  );

  return keyboardCover > dockOffsetPx ? keyboardCover : dockOffsetPx;
}
