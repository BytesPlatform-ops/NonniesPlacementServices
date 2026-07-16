import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared submit-error banner shown when the email endpoint call fails. */
export function FormError({ show, className }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-xl border border-coral/25 bg-coral/[0.06] px-4 py-3 text-sm font-medium text-coral",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      Something went wrong while submitting the form. Please try again or contact us directly.
    </p>
  );
}
