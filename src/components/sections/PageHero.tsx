import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/animation/Reveal";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/animation/MagneticButton";
import { cn } from "@/lib/utils";

type CTA = { label: string; href: string };
type Stat = { v: string; l: string };

/** Interior-page hero — lighter than the WebGL homepage hero, but never empty. */
export function PageHero({
  eyebrow,
  title,
  description,
  tone = "light",
  primary,
  secondary,
  media,
  stats,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  tone?: "light" | "dark";
  primary?: CTA;
  secondary?: CTA;
  media?: React.ReactNode;
  stats?: Stat[];
}) {
  const dark = tone === "dark";
  return (
    <section className={cn("relative overflow-hidden pt-32 pb-16 sm:pt-36 sm:pb-20", dark ? "bg-midnight text-white" : "bg-ice")}>
      {dark ? (
        <div className="pointer-events-none absolute inset-0 hero-gradient-fallback opacity-70" />
      ) : (
        <>
          <div className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-teal/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-blue/10 blur-3xl" />
        </>
      )}
      {dark && <div className="pointer-events-none absolute inset-0 bg-midnight/45" />}

      <Container className="relative">
        <div className={cn("grid gap-10", media && "lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14")}>
          <Reveal className="flex max-w-2xl flex-col gap-5">
            <Badge tone={dark ? "mint" : "teal"}>{eyebrow}</Badge>
            <h1 className={cn("font-display text-[clamp(2.3rem,5.4vw,4rem)] font-medium leading-[1.03] tracking-tight text-balance", dark ? "text-white" : "text-navy")}>
              {title}
            </h1>
            <p className={cn("max-w-2xl text-lg leading-relaxed text-pretty", dark ? "text-white/75" : "text-slate-ink")}>{description}</p>
            {(primary || secondary) && (
              <div className="mt-1 flex flex-wrap gap-3">
                {primary && (
                  <MagneticButton>
                    <Button href={primary.href} variant={dark ? "dark" : "primary"} size="lg">{primary.label}</Button>
                  </MagneticButton>
                )}
                {secondary && (
                  <Button href={secondary.href} variant={dark ? "outline-light" : "secondary"} size="lg">{secondary.label}</Button>
                )}
              </div>
            )}
            {stats && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {stats.map((s) => (
                  <div key={s.l} className={cn("rounded-2xl border p-4", dark ? "border-white/10 bg-white/5" : "border-navy/10 bg-white/70")}>
                    <p className={cn("font-display text-2xl font-semibold", dark ? "text-mint" : "text-teal")}>{s.v}</p>
                    <p className={cn("text-xs", dark ? "text-white/60" : "text-slate-ink")}>{s.l}</p>
                  </div>
                ))}
              </div>
            )}
          </Reveal>

          {media && <Reveal className="relative">{media}</Reveal>}
        </div>
      </Container>
    </section>
  );
}
