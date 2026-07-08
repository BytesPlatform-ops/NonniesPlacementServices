/** Tiny coordinator so the hero reveal fires exactly when the preloader clears. */

const READY_EVENT = "nonnis:ready";

type ReadyWindow = Window & { __nonnisReady?: boolean };

export function signalReady() {
  if (typeof window === "undefined") return;
  (window as ReadyWindow).__nonnisReady = true;
  window.dispatchEvent(new Event(READY_EVENT));
}

/** Run `cb` once the site is ready (preloader done or skipped). Returns cleanup. */
export function onReady(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if ((window as ReadyWindow).__nonnisReady) {
    cb();
    return () => {};
  }
  const handler = () => cb();
  window.addEventListener(READY_EVENT, handler, { once: true });
  return () => window.removeEventListener(READY_EVENT, handler);
}
