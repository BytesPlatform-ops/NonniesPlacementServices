/**
 * Static animated-CSS gradient — the fallback for reduced-motion, mobile, and
 * any WebGL failure (§3.7.3). Pure CSS; the drift animation self-disables under
 * prefers-reduced-motion via globals.css.
 */
export function StaticHeroPoster() {
  return <div className="hero-gradient-fallback absolute inset-0" aria-hidden="true" />;
}
