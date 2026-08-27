import { UserRound } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="text-sm font-medium text-slate-500">Digital Optimization Platform</div>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="hidden sm:inline">Operations</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <UserRound className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </header>
  );
}
