import { cn } from "@/lib/utils";

/**
 * Line-art mark derived from the Nonni's brand shape (a sheltering home around
 * people in care). Traced as an SVG so the preloader can stroke-draw it (§3.8-A).
 * The full color logo asset lives at /brand_assets/logo.png.
 */
export function LogoMark({
  className,
  stroke = "#b56f28",
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="Nonni's mark"
      className={cn("logo-mark", className)}
    >
      <g
        stroke={stroke}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Sheltering care arch */}
        <path d="M18 74 A42 42 0 0 1 102 74" />
        {/* Medical cross */}
        <path d="M30 25 L30 39" />
        <path d="M23 32 L37 32" />
        {/* Care bed: raised head, mattress, foot, legs */}
        <path d="M32 88 L32 74 L44 74" />
        <path d="M32 88 L90 88" />
        <path d="M90 88 L90 80" />
        <path d="M37 88 L37 96" />
        <path d="M85 88 L85 96" />
        <circle cx="39" cy="69" r="4" />
        <circle cx="37" cy="99" r="2.4" />
        <circle cx="85" cy="99" r="2.4" />
      </g>
    </svg>
  );
}
