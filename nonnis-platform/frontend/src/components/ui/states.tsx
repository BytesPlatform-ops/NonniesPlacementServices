import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

/** Inline loading indicator for panels and lists. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500" role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/** Empty result placeholder. */
export function EmptyState({
  title = "Nothing here yet",
  message,
  icon,
}: {
  title?: string;
  message?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </span>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {message ? <p className="max-w-sm text-sm text-slate-500">{message}</p> : null}
    </div>
  );
}

/** Error placeholder with an optional retry action. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center" role="alert">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium text-slate-800">Something went wrong</p>
        <p className="mt-0.5 max-w-md text-sm text-slate-500">{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
