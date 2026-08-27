import { humanizeEnum } from "@/lib/format";
import type { CaseRequirementView } from "@/types/domain";

export function RequirementList({ requirements }: { requirements: CaseRequirementView[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {requirements.map((requirement) => (
        <li key={requirement.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide text-slate-500">
                {humanizeEnum(requirement.category)}
              </span>
              <p className="text-sm font-medium text-slate-800">{requirement.label}</p>
            </div>
            {requirement.detail ? <p className="mt-1 text-sm text-slate-500">{requirement.detail}</p> : null}
          </div>
          <span
            className={
              requirement.mandatory
                ? "shrink-0 text-xs font-medium text-slate-600"
                : "shrink-0 text-xs text-slate-400"
            }
          >
            {requirement.mandatory ? "Required" : "Optional"}
          </span>
        </li>
      ))}
    </ul>
  );
}
