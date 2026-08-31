import { describe, expect, it } from "vitest";
import {
  AUTOSCROLL_INTERVAL_MS,
  MANUAL_RESUME_DELAY_MS,
  manualPauseUntil,
  shouldAutoplayInline,
  shouldAutoscroll,
  type AutoscrollState,
} from "./carousel";

const base: AutoscrollState = {
  reducedMotion: false,
  hovering: false,
  dragging: false,
  lightboxOpen: false,
  tabHidden: false,
  itemCount: 5,
  now: 1000,
  pausedUntil: 0,
};

describe("timing constants", () => {
  it("auto-advances every ~2.5s and resumes ~5s after manual interaction", () => {
    expect(AUTOSCROLL_INTERVAL_MS).toBeGreaterThanOrEqual(2000);
    expect(AUTOSCROLL_INTERVAL_MS).toBeLessThanOrEqual(3000);
    expect(MANUAL_RESUME_DELAY_MS).toBeGreaterThanOrEqual(4000);
    expect(MANUAL_RESUME_DELAY_MS).toBeLessThanOrEqual(6000);
    expect(manualPauseUntil(1000)).toBe(1000 + MANUAL_RESUME_DELAY_MS);
  });
});

describe("shouldAutoscroll", () => {
  it("advances by default with multiple items", () => {
    expect(shouldAutoscroll(base)).toBe(true);
  });

  it("pauses on hover, drag, open lightbox, hidden tab, reduced motion", () => {
    expect(shouldAutoscroll({ ...base, hovering: true })).toBe(false);
    expect(shouldAutoscroll({ ...base, dragging: true })).toBe(false);
    expect(shouldAutoscroll({ ...base, lightboxOpen: true })).toBe(false);
    expect(shouldAutoscroll({ ...base, tabHidden: true })).toBe(false);
    expect(shouldAutoscroll({ ...base, reducedMotion: true })).toBe(false);
  });

  it("stays paused until the manual-resume delay passes", () => {
    expect(shouldAutoscroll({ ...base, now: 1000, pausedUntil: 5000 })).toBe(false);
    expect(shouldAutoscroll({ ...base, now: 6000, pausedUntil: 5000 })).toBe(true);
  });

  it("does not advance a single-item rail", () => {
    expect(shouldAutoscroll({ ...base, itemCount: 1 })).toBe(false);
  });
});

describe("shouldAutoplayInline", () => {
  it("plays muted previews unless reduced-motion / lightbox / hidden tab", () => {
    expect(shouldAutoplayInline({ reducedMotion: false, lightboxOpen: false, tabHidden: false })).toBe(true);
    expect(shouldAutoplayInline({ reducedMotion: true, lightboxOpen: false, tabHidden: false })).toBe(false);
    expect(shouldAutoplayInline({ reducedMotion: false, lightboxOpen: true, tabHidden: false })).toBe(false);
    expect(shouldAutoplayInline({ reducedMotion: false, lightboxOpen: false, tabHidden: true })).toBe(false);
  });
});
