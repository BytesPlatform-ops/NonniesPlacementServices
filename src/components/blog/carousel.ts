/**
 * Pure, testable timing/state logic for the short-video rail. The DOM wiring
 * lives in ShortVideoStrip; these functions keep the decision rules unit-testable
 * and free of timing fragility.
 */

export const AUTOSCROLL_INTERVAL_MS = 2500;
export const MANUAL_RESUME_DELAY_MS = 5000;

export interface AutoscrollState {
  reducedMotion: boolean;
  hovering: boolean;
  dragging: boolean;
  lightboxOpen: boolean;
  tabHidden: boolean;
  itemCount: number;
  now: number;
  pausedUntil: number;
}

/** Whether the carousel should advance right now. */
export function shouldAutoscroll(s: AutoscrollState): boolean {
  if (s.reducedMotion) return false;
  if (s.itemCount < 2) return false;
  if (s.hovering || s.dragging || s.lightboxOpen || s.tabHidden) return false;
  if (s.now < s.pausedUntil) return false;
  return true;
}

/** Whether inline muted previews should autoplay. Reduced-motion pauses them. */
export function shouldAutoplayInline(s: { reducedMotion: boolean; lightboxOpen: boolean; tabHidden: boolean }): boolean {
  return !s.reducedMotion && !s.lightboxOpen && !s.tabHidden;
}

/** Timestamp until which auto-progression is paused after a manual interaction. */
export function manualPauseUntil(now: number): number {
  return now + MANUAL_RESUME_DELAY_MS;
}
