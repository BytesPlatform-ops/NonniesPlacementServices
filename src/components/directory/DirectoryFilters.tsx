"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ResidentialDirectoryOptions } from "@/lib/platform/content";

const selectCls =
  "w-full rounded-full border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral";

interface FilterDef {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

/** Family-facing directory search + filters. Server-side filtering via the URL. */
export function DirectoryFilters({ options, total }: { options: ResidentialDirectoryOptions; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(params.get("q") ?? "");

  const filters: FilterDef[] = [
    { key: "state", label: "State", options: options.states.map((s) => ({ value: s, label: s })) },
    { key: "serviceCategory", label: "Care type", options: options.serviceCategories.map((c) => ({ value: c.id, label: c.name })) },
    { key: "language", label: "Language", options: options.languages.map((l) => ({ value: l.id, label: l.name })) },
    { key: "paymentType", label: "Payment", options: options.paymentTypes.map((p) => ({ value: p.id, label: p.name })) },
  ];

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(next.toString() ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };

  // Debounce the free-text search (writes to the URL; does not setState here).
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== search) setParam("q", search.trim());
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const reset = () => {
    setSearch("");
    router.push(pathname, { scroll: false });
  };

  const removeChip = (key: string) => {
    if (key === "q") setSearch("");
    setParam(key, "");
  };

  const activeChips = [
    ...(params.get("q") ? [{ key: "q", label: `“${params.get("q")}”` }] : []),
    ...filters
      .filter((f) => params.get(f.key))
      .map((f) => {
        const value = params.get(f.key)!;
        const opt = f.options.find((o) => o.value === value);
        return { key: f.key, label: `${f.label}: ${opt?.label ?? value}` };
      }),
  ];

  const filterSelects = () => (
    <>
      {filters.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-ink/70 sm:sr-only">{f.label}</span>
          <select value={params.get(f.key) ?? ""} onChange={(e) => setParam(f.key, e.target.value)} className={selectCls} aria-label={f.label}>
            <option value="">{f.label}: Any</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-ink/70 sm:sr-only">Sort</span>
        <select value={params.get("sort") ?? ""} onChange={(e) => setParam("sort", e.target.value)} className={selectCls} aria-label="Sort">
          <option value="">Featured order</option>
          <option value="name">Name A–Z</option>
          <option value="recent">Recently updated</option>
        </select>
      </label>
    </>
  );

  return (
    <div className="rounded-[26px] border border-navy/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-ink/50" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or city"
            aria-label="Search residential providers"
            className="w-full rounded-full border border-navy/15 bg-white py-3 pl-11 pr-4 text-sm text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          />
        </div>

        {/* Desktop inline filters */}
        <div className="hidden gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-5">
          {filterSelects()}
        </div>

        {/* Mobile: Filters button */}
        <div className="flex items-center justify-between sm:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-2 text-sm font-medium text-navy"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters{activeChips.length > 0 ? ` (${activeChips.length})` : ""}
          </button>
          <span className="text-sm text-slate-ink/70">{total} communities</span>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => removeChip(chip.key)}
              className="inline-flex items-center gap-1 rounded-full bg-ice px-3 py-1 text-xs font-medium text-navy hover:bg-sand"
            >
              {chip.label} <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
          <button type="button" onClick={reset} className="text-xs font-semibold text-coral underline">
            Clear all
          </button>
        </div>
      ) : null}

      {/* Mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-midnight/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[26px] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-medium text-navy">Filters</h2>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close filters" className="rounded-full p-1 text-slate-ink hover:bg-ice">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="grid gap-3">
              {filterSelects()}
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={reset} className="flex-1 rounded-full border border-navy/15 px-4 py-2.5 text-sm font-medium text-navy">
                Clear
              </button>
              <button type="button" onClick={() => setDrawer(false)} className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm font-semibold text-white">
                Show {total}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
