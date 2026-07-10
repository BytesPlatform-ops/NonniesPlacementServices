import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Secure operational notice shown near form submission fields. Confirms that
 * patient data is handled under HIPAA-compliant storage frameworks.
 */
export function DataSecurityNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-xs leading-relaxed text-slate-ink/70",
        className,
      )}
    >
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
      <span>
        Your information is secure. Patient data is processed and stored using secure,
        HIPAA-compliant data storage frameworks.
      </span>
    </p>
  );
}
