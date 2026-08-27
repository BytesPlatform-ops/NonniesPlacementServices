import type { ReactNode } from "react";

export interface DescriptionItem {
  label: string;
  value: ReactNode;
}

/** A responsive key/value grid for record detail sections. */
export function DescriptionList({ items }: { items: DescriptionItem[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.label}</dt>
          <dd className="mt-1 break-words text-sm text-slate-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
