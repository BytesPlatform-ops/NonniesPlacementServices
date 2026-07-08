import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { AIMatchDashboard } from "@/components/product/AIMatchDashboard";
import { IntakeTimeline } from "@/components/product/IntakeTimeline";
import { HOW_IT_WORKS } from "@/data/steps";
import { cn } from "@/lib/utils";

/** How it works — clean non-pinned visual timeline + a live product showcase. */
export function HowItWorksScrollytelling() {
  return (
    <Section id="how-it-works" tone="light" density="normal">
      <SectionHeading
        eyebrow="How it works"
        title="From a stressful moment to a settled placement"
        description="Five coordinated steps, one Registered Nurse guiding the way — the product does the heavy lifting, the RN makes the call."
        align="center"
        className="mx-auto"
      />

      {/* Horizontal step timeline */}
      <Reveal stagger={0.1} className="mt-14">
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.id}
                data-reveal
                className="group relative flex h-full flex-col rounded-3xl border border-navy/12 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-teal/40 hover:shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/10 text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-display text-3xl font-semibold text-navy/12 transition-colors group-hover:text-teal/30">
                    0{step.id}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-medium text-navy">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-ink">{step.description}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <span className="pointer-events-none absolute right-0 top-11 hidden h-px w-5 translate-x-full bg-navy/15 lg:block" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
      </Reveal>

      {/* Live product showcase */}
      <div className="mt-16 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">See the match happen</p>
          <h3 className="mt-3 font-display text-[clamp(1.7rem,3vw,2.4rem)] font-medium leading-tight text-navy">
            The RN-reviewed match, in real time
          </h3>
          <p className="mt-3 max-w-md text-slate-ink">
            As intake and assessment complete, the platform ranks the strongest care-fit options — and a nurse
            clears them before they reach the family.
          </p>
          <div className="mt-6">
            <IntakeTimeline tone="light" />
          </div>
        </Reveal>
        <Reveal className={cn("lg:pl-2")}>
          <AIMatchDashboard />
        </Reveal>
      </div>
    </Section>
  );
}
