/**
 * Fire `cb` once when `el` first enters the viewport, via IntersectionObserver.
 *
 * Used instead of GSAP ScrollTrigger for any animation that HIDES content
 * (fades/clips it in), because ScrollTrigger is synced to Lenis and can fail to
 * fire on programmatic scroll — leaving content stuck invisible. IO is reliable,
 * and a failsafe guarantees the callback always runs so nothing stays hidden.
 */
export function onInView(el: Element, cb: () => void, rootMargin = "0px 0px -8% 0px"): () => void {
  if (typeof IntersectionObserver === "undefined") {
    cb();
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          cb();
          io.disconnect();
          break;
        }
      }
    },
    { threshold: 0.1, rootMargin },
  );
  io.observe(el);
  const t = window.setTimeout(() => {
    cb();
    io.disconnect();
  }, 2500);
  return () => {
    io.disconnect();
    window.clearTimeout(t);
  };
}
