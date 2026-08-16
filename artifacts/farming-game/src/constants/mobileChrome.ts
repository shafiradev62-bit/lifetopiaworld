/** Mobile bottom hotbar height (farm tools row vs slim hint bar). */
export const MOBILE_HOTBAR_HOME_PX = 56;
export const MOBILE_HOTBAR_OTHER_PX = 44;

/** Thin row above hotbar: MAP + contextual buttons (all maps). */
export const MOBILE_ACTION_ROW_PX = 34;

/** Space to leave clear for hold-to-move (above action row + hotbar). */
export function mobilePlayAreaBottomInsetPx(isHomeMap: boolean): number {
  return (isHomeMap ? MOBILE_HOTBAR_HOME_PX : MOBILE_HOTBAR_OTHER_PX) + MOBILE_ACTION_ROW_PX;
}
