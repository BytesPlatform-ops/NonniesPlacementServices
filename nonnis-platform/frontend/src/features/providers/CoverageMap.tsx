"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoverageAreaView } from "@/types/providers";

/**
 * Where a provider covers, as a drill-down.
 *
 *   state grid  →  click a state  →  its cities / counties / postal codes
 *               →  click one      →  the individual coverage entries
 *
 * The grid is schematic on purpose. Coverage is stored as text — city, county,
 * state, postal code, radius — with no coordinates anywhere, so real borders or
 * a radius circle would mean geocoding every entry against a paid external
 * service. A tile per state answers "where do we cover?" from the data that
 * actually exists, with no dependency and no invented precision; the drill-down
 * supplies the detail a real map would otherwise have to carry.
 *
 * Column runs west to east, row north to south, so the shape reads as the
 * United States at a glance.
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

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const ROWS = 8;
const COLS = 11;

const TYPE_LABELS: Record<string, string> = {
  CITY: "City",
  COUNTY: "County",
  STATE: "Statewide",
  POSTAL_CODE: "Postal code",
  RADIUS: "Radius",
};

/**
 * Heat is the number of coverage entries in a state, in four bands.
 *
 * Banded rather than continuous: an eye reads "more than that one" far better
 * from four steps than from fifty shades, and the darkest band still holds
 * white text legibly.
 */
function heatClasses(count: number): string {
  if (count >= 7) return "bg-brand-800 text-white hover:bg-brand-900";
  if (count >= 4) return "bg-brand-700 text-white hover:bg-brand-800";
  if (count >= 2) return "bg-brand-500 text-white hover:bg-brand-600";
  return "bg-brand-200 text-brand-900 hover:bg-brand-500 hover:text-white";
}

const HEAT_LEGEND = [
  { label: "1", className: "bg-brand-200" },
  { label: "2–3", className: "bg-brand-500" },
  { label: "4–6", className: "bg-brand-700" },
  { label: "7+", className: "bg-brand-800" },
];

/** The place an entry names inside its state — the second level of the tree. */
function placeOf(area: CoverageAreaView): string {
  if (area.city?.trim()) return area.city.trim();
  if (area.county?.trim()) return `${area.county.trim()} County`;
  if (area.postalCode?.trim()) return area.postalCode.trim();
  return "Statewide";
}

/** One entry, described in the wording the rest of the portal uses. */
function areaLabel(area: CoverageAreaView): string {
  switch (area.coverageType) {
    case "RADIUS":
      return area.radiusMiles
        ? `Within ${area.radiusMiles} mi of ${[area.city, area.state].filter(Boolean).join(", ")}`
        : [area.city, area.state].filter(Boolean).join(", ");
    case "COUNTY":
      return [area.county ? `${area.county} County` : null, area.state].filter(Boolean).join(", ");
    case "STATE":
      return `All of ${STATE_NAMES[area.state?.toUpperCase() ?? ""] ?? area.state ?? ""}`;
    case "POSTAL_CODE":
      return area.postalCode ?? "";
    default:
      return [area.city, area.state].filter(Boolean).join(", ");
  }
}

export function CoverageMap({ areas }: { areas: CoverageAreaView[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [openPlace, setOpenPlace] = useState<string | null>(null);

  const { byState, unplaced, active } = useMemo(() => {
    const active = areas.filter((a) => a.active);
    const byState = new Map<string, CoverageAreaView[]>();
    let unplaced = 0;
    for (const area of active) {
      const code = area.state?.trim().toUpperCase();
      if (!code || !(code in GRID)) {
        unplaced += 1;
        continue;
      }
      byState.set(code, [...(byState.get(code) ?? []), area]);
    }
    return { byState, unplaced, active };
  }, [areas]);

  // Places inside the state being inspected, each with its own entries.
  const places = useMemo(() => {
    if (!selected) return [];
    const grouped = new Map<string, CoverageAreaView[]>();
    for (const area of byState.get(selected) ?? []) {
      const place = placeOf(area);
      grouped.set(place, [...(grouped.get(place) ?? []), area]);
    }
    return [...grouped.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [selected, byState]);

  if (active.length === 0) return null;

  const open = (code: string) => {
    setSelected((current) => (current === code ? null : code));
    setOpenPlace(null);
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Where you cover</p>
        <p className="text-xs text-slate-500">
          {byState.size} {byState.size === 1 ? "state" : "states"} · {active.length}{" "}
          {active.length === 1 ? "area" : "areas"}
          {unplaced > 0 ? ` · ${unplaced} without a state` : ""}
        </p>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-5">
        {/* ---- level 1: the states ---- */}
        <div className="lg:col-span-3">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${ROWS}, auto)` }}
          >
            {Object.entries(GRID).map(([code, [row, col]]) => {
              const list = byState.get(code);
              const count = list?.length ?? 0;
              const isSelected = selected === code;
              const style = { gridRow: row + 1, gridColumn: col + 1 };
              const shared =
                "flex aspect-square items-center justify-center rounded-[3px] text-[10px] font-semibold tabular-nums transition-colors";

              // A state with no coverage is not a control: there is nothing to
              // open, so it stays inert rather than offering a dead click.
              if (count === 0) {
                return (
                  <div key={code} style={style} title={STATE_NAMES[code]} className={cn(shared, "bg-slate-100 text-slate-400")}>
                    {code}
                  </div>
                );
              }
              return (
                <button
                  key={code}
                  type="button"
                  style={style}
                  onClick={() => open(code)}
                  aria-pressed={isSelected}
                  title={`${STATE_NAMES[code]} — ${count} ${count === 1 ? "area" : "areas"}`}
                  className={cn(
                    shared,
                    heatClasses(count),
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1",
                    isSelected && "ring-2 ring-brand-900 ring-offset-1",
                  )}
                >
                  {code}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              Areas
              {HEAT_LEGEND.map((band) => (
                <span key={band.label} className="flex items-center gap-1">
                  <span className={cn("h-3 w-3 rounded-[3px]", band.className)} aria-hidden />
                  {band.label}
                </span>
              ))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] bg-slate-100" aria-hidden /> None
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Schematic — one tile per state, not to scale. Select a state for detail.</p>
        </div>

        {/* ---- levels 2 and 3: inside the selected state ---- */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex h-full min-h-[8rem] items-center justify-center rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
              Select a shaded state to see the cities and areas covered there.
            </div>
          ) : (
            <div className="rounded-md border border-slate-200">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-umber">{STATE_NAMES[selected] ?? selected}</p>
                  <p className="text-xs text-slate-500">
                    {places.length} {places.length === 1 ? "place" : "places"} ·{" "}
                    {byState.get(selected)?.length ?? 0} areas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close state detail"
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {places.map(([place, entries]) => {
                  const expanded = openPlace === place;
                  return (
                    <li key={place}>
                      <button
                        type="button"
                        onClick={() => setOpenPlace(expanded ? null : place)}
                        aria-expanded={expanded}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{place}</span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
                          {entries.length}
                        </span>
                      </button>

                      {expanded ? (
                        <ul className="space-y-1 border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                          {entries.map((entry) => (
                            <li key={entry.id} className="text-xs">
                              <span className="mr-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                                {TYPE_LABELS[entry.coverageType] ?? entry.coverageType}
                              </span>
                              <span className="text-slate-700">{areaLabel(entry)}</span>
                              {entry.notes ? <span className="block pt-0.5 text-slate-500">{entry.notes}</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
