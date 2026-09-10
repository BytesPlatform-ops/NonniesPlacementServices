"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { SeekerCaseSummary } from "@/types/seeker";

/**
 * Case selector for a relative authorized on more than one case.
 *
 * Renders nothing for the overwhelmingly common single-case family, so the
 * portal stays as simple as it should be. The choice lives in the URL rather
 * than in state, so a link a family member saves or shares still opens the
 * case they meant.
 */
export function SeekerCaseSwitcher({ cases, activeCaseId }: { cases: SeekerCaseSummary[]; activeCaseId: string }) {
  const router = useRouter();
  const params = useSearchParams();

  if (cases.length < 2) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Viewing</span>
      <select
        value={activeCaseId}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("caseId", e.target.value);
          router.replace(`?${next.toString()}`);
        }}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700"
      >
        {cases.map((c) => (
          <option key={c.caseId} value={c.caseId}>
            {c.careRecipientName}
            {c.relationship ? ` (${c.relationship})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
