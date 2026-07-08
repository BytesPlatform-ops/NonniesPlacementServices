import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Real brand lockup (bronze care-arch mark + NONNIS · PLACEMENT), trimmed tight.
const LOCKUP = "/brand/nonnis-lockup.png";
const LOCKUP_LIGHT = "/brand/nonnis-lockup-light.png"; // reversed (white) for dark surfaces
const RATIO = 484 / 125; // intrinsic aspect of the trimmed lockup

/** Brand lockup — the official Nonni's Placement logo, tone-aware. */
export function Logo({
  className,
  size = 44,
  tone = "light",
}: {
  className?: string;
  /** rendered height of the lockup in px */
  size?: number;
  showWordmark?: boolean;
  tone?: "light" | "dark";
}) {
  const height = size;
  const width = Math.round(size * RATIO);
  return (
    <Link
      href="/"
      aria-label="Nonni's Placement Services — home"
      className={cn("group inline-flex items-center", className)}
    >
      <Image
        src={tone === "dark" ? LOCKUP_LIGHT : LOCKUP}
        alt="Nonni's Placement Services"
        width={width}
        height={height}
        priority
        className="w-auto transition-transform duration-300 group-hover:-translate-y-0.5"
        style={{ height, width: "auto" }}
      />
    </Link>
  );
}
