"use client";

import { cn } from "@/lib/utils";
import type { CoverageAreaView } from "@/types/providers";

/**
 * A schematic map of the states a provider serves.
 *
 * Deliberately a tile grid rather than real geography. Coverage is stored as
 * text — city, county, state, postal code, radius — with no coordinates
 * anywhere, so drawing true borders or a radius circle would require geocoding
 * every entry against an external service. A tile grid answers the question
 * that is actually being asked — "where do we cover?" — from the data that
 * exists, with no dependency, no API key and no invented precision.
 *
 * Column runs west to east, row runs north to south, so the shape reads as the
 * United States at a glance. Alaska and Hawaii sit at the corners, as they do
 * on almost every US map.
 */
const GRID: Record<string, [row: number, col: number]> = {
  AK: [0, 0], ME: [0, 10],
  VT: [1, 9], NH: [1, 10],
  WA: [2, 0], ID: [2, 1], MT: [2, 2], ND: [2, 3], MN: [2, 4], WI: [2, 5], MI: [2, 6], NY: [2, 8], MA: [2, 9], RI: [2, 10],
  OR: [3, 0], NV: [3, 1], WY: [3, 2], SD: [3, 3], IA: [3, 4], IL: [3, 5], IN: [3, 6], OH: [3, 7], PA: [3, 8], NJ: [3, 9], CT: [3, 10],
  CA: [4, 0], UT: [4, 1], CO: [4, 2], NE: [4, 3], MO: [4, 4], KY: [4, 5], WV: [4, 6], VA: [4, 7], MD: [4, 8], DE: [4, 9],
  AZ: [5, 1], NM: [5, 2], KS: [5, 3], AR: [5, 4], TN: [5, 5], NC: [5, 6], SC: [5, 7],
  OK: [6, 3], LA: [6, 4], MS: [6, 5], AL: [6, 6], GA: [6, 7],
  HI: [7, 0], TX: [7, 3], FL: [7, 8],
};

const ROWS = 8;
const COLS = 11;

/** Areas grouped by the state they name, ignoring entries with no state. */
function byState(areas: CoverageAreaView[]): Map<string, CoverageAreaView[]> {
  const map = new Map<string, CoverageAreaView[]>();
  for (const area of areas) {
    if (!area.active) continue;
    const code = area.state?.trim().toUpperCase();
    if (!code || !(code in GRID)) continue;
    map.set(code, [...(map.get(code) ?? []), area]);
  }
  return map;
}

/** One line per area, in the wording the rest of the portal uses. */
function areaLabel(area: CoverageAreaView): string {
  switch (area.coverageType) {
    case "CITY":
      return [area.city, area.state].filter(Boolean).join(", ");
    case "COUNTY":
      return [area.county ? `${area.county} County` : null, area.state].filter(Boolean).join(", ");
    case "STATE":
      return area.state ?? "";
    case "POSTAL_CODE":
      return area.postalCode ?? "";
    case "RADIUS":
      return area.radiusMiles
        ? `Within ${area.radiusMiles} mi of ${[area.city, area.state].filter(Boolean).join(", ")}`
        : [area.city, area.state].filter(Boolean).join(", ");
    default:
      return "";
  }
}

export function CoverageMap({ areas }: { areas: CoverageAreaView[] }) {
  const covered = byState(areas);
  const active = areas.filter((a) => a.active);
  // Entries that name no state cannot be placed — a bare postal code, say.
  // They are counted rather than silently dropped.
  const unplaced = active.length - [...covered.values()].reduce((n, list) => n + list.length, 0);

  if (active.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Where you cover</p>
        <p className="text-xs text-slate-500">
          {covered.size} {covered.size === 1 ? "state" : "states"} · {active.length}{" "}
          {active.length === 1 ? "area" : "areas"}
          {unplaced > 0 ? ` · ${unplaced} without a state` : ""}
        </p>
      </div>

      <div
        role="img"
        aria-label={
          covered.size === 0
            ? "No states covered"
            : `States covered: ${[...covered.keys()].sort().join(", ")}`
        }
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${ROWS}, auto)` }}
      >
        {Object.entries(GRID).map(([code, [row, col]]) => {
          const list = covered.get(code);
          const isCovered = Boolean(list?.length);
          return (
            <div
              key={code}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              // The full list of areas for a state, on hover and for assistive tech.
              title={isCovered ? `${code}: ${list!.map(areaLabel).filter(Boolean).join(" · ")}` : code}
              className={cn(
                "flex aspect-square items-center justify-center rounded-[3px] text-[10px] font-semibold tabular-nums transition-colors",
                isCovered
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-400",
              )}
            >
              {code}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-brand-600" aria-hidden /> Covered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-slate-100" aria-hidden /> Not covered
        </span>
        <span className="text-slate-400">Schematic — one tile per state, not to scale.</span>
      </div>
    </div>
  );
}
