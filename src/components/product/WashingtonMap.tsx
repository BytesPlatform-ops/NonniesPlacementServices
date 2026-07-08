"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { onInView } from "@/lib/inView";
import { cn } from "@/lib/utils";

// Approximate, stylized Washington State silhouette (jagged Pacific/Puget left edge).
const WA_PATH =
  "M4,10 L54,8 L74,7 L96,8 L96,52 L58,54 L34,55 L20,54 L20,49 L16,48 L17,44 L12,42 L14,38 L9,36 L12,31 L7,29 L11,25 L6,22 L10,18 L5,15 Z";

// City nodes in the same 100×62 viewBox. Tacoma is the hub.
const NODES = [
  { name: "Tacoma", x: 17, y: 32, hub: true },
  { name: "Seattle", x: 18, y: 26 },
  { name: "Bellevue", x: 22, y: 26 },
  { name: "Everett", x: 19, y: 21 },
  { name: "Olympia", x: 15, y: 35 },
  { name: "Bellingham", x: 19, y: 12 },
  { name: "Vancouver", x: 21, y: 50 },
  { name: "Yakima", x: 50, y: 40 },
  { name: "Wenatchee", x: 57, y: 27 },
  { name: "Tri-Cities", x: 66, y: 45 },
  { name: "Spokane", x: 85, y: 24 },
];

export function WashingtonMap({ tone = "dark", className }: { tone?: "light" | "dark"; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const dark = tone === "dark";
  const hub = NODES.find((n) => n.hub)!;
  const stroke = dark ? "#d18f47" : "#b56f28";

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const lines = el.querySelectorAll<SVGLineElement>("[data-link]");
      const dots = el.querySelectorAll<SVGCircleElement>("[data-node]");
      if (reduced) return;
      lines.forEach((l) => {
        const len = l.getTotalLength();
        gsap.set(l, { strokeDasharray: len, strokeDashoffset: len });
      });
      gsap.set(dots, { scale: 0, transformOrigin: "center" });
      return onInView(el, () => {
        gsap.to(lines, { strokeDashoffset: 0, duration: 1.2, stagger: 0.08, ease: "power2.out" });
        gsap.to(dots, { scale: 1, duration: 0.5, stagger: 0.06, ease: "back.out(2)" });
      });
    },
    { scope: ref },
  );

  return (
    <svg
      ref={ref}
      viewBox="0 0 100 62"
      className={cn("h-full w-full", className)}
      role="img"
      aria-label="Care network across Washington State"
    >
      <defs>
        <radialGradient id="waglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={dark ? "#d18f47" : "#b56f28"} stopOpacity="0.25" />
          <stop offset="100%" stopColor={dark ? "#d18f47" : "#b56f28"} stopOpacity="0" />
        </radialGradient>
      </defs>

      <path
        d={WA_PATH}
        fill={dark ? "rgba(209,143,71,0.08)" : "rgba(181,111,40,0.08)"}
        stroke={dark ? "rgba(209,143,71,0.35)" : "rgba(71,46,22,0.3)"}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />

      {/* Connection lines hub → nodes */}
      {NODES.filter((n) => !n.hub).map((n) => (
        <line
          key={`l-${n.name}`}
          data-link
          x1={hub.x}
          y1={hub.y}
          x2={n.x}
          y2={n.y}
          stroke={stroke}
          strokeWidth="0.35"
          strokeOpacity="0.5"
        />
      ))}

      {/* Nodes */}
      {NODES.map((n) => (
        <g key={n.name}>
          {n.hub && <circle cx={n.x} cy={n.y} r="7" fill="url(#waglow)" />}
          <circle
            data-node
            cx={n.x}
            cy={n.y}
            r={n.hub ? 1.9 : 1.1}
            fill={n.hub ? stroke : dark ? "#e2b483" : "#472e16"}
          >
            {n.hub && <animate attributeName="r" values="1.9;2.6;1.9" dur="2.4s" repeatCount="indefinite" />}
          </circle>
        </g>
      ))}
    </svg>
  );
}
