import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Local-only success state — no backend request is made (§16). */
export function FormSuccess({
  title,
  message,
  onReset,
}: {
  title: string;
  message: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-teal/30 bg-white p-10 text-center shadow-card">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-teal/15 text-teal">
        <CheckCircle2 className="h-9 w-9" aria-hidden />
      </span>
      <h3 className="mt-5 font-display text-2xl font-medium text-navy">{title}</h3>
      <p className="mt-2 max-w-md text-slate-ink">{message}</p>
      <p className="mt-4 rounded-xl bg-ice px-4 py-2 text-xs font-medium text-slate-ink">
        This is a demonstration frontend — no information was sent or stored.
      </p>
      <Button onClick={onReset} variant="ghost" className="mt-6">
        Submit another response
      </Button>
    </div>
  );
}
