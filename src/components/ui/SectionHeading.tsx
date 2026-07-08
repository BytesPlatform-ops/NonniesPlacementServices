import { cn } from "@/lib/utils";
import { Badge } from "./Badge";
import { Reveal } from "@/components/animation/Reveal";

type Align = "left" | "center";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
  badgeTone,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: Align;
  tone?: "light" | "dark";
  className?: string;
  badgeTone?: "teal" | "coral" | "navy" | "mint";
}) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start",
        className,
      )}
    >
      {eyebrow && <Badge tone={badgeTone ?? (tone === "dark" ? "mint" : "teal")}>{eyebrow}</Badge>}
      <h2
        className={cn(
          "max-w-3xl font-display text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.05] tracking-tight text-balance",
          tone === "dark" ? "text-white" : "text-navy",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "max-w-2xl text-lg leading-relaxed text-pretty",
            tone === "dark" ? "text-white/70" : "text-slate-ink",
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}
