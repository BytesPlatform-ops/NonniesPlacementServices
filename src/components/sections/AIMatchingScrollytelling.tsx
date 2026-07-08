import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/animation/Reveal";
import { AIMatchDashboard } from "@/components/product/AIMatchDashboard";
import { RNReviewChecklist } from "@/components/product/RNReviewChecklist";
import { AI_PIPELINE, AI_SIGNALS } from "@/data/steps";

/** AI + RN review — clean non-pinned dark product demo. */
export function AIMatchingScrollytelling() {
  return (
    <section id="ai-matching" className="relative overflow-hidden bg-midnight py-16 text-white sm:py-[92px]" style={{ scrollMarginTop: "5rem" }}>
      {/* Soft warm gradient wash (no second WebGL canvas — keeps it light) */}
      <div className="pointer-events-none absolute inset-0 hero-gradient-fallback opacity-40" />
      <div className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-teal/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-midnight/40" />

      <Container className="relative z-10">
        <SectionHeading
          eyebrow="How matching works"
          tone="dark"
          title={<>Intelligent matching, <span className="gradient-text-mint">human-reviewed</span></>}
          description="Structured signals become a ranked shortlist — 5 options, top 3 — then a Registered Nurse has the final word. This is the platform, working."
          align="center"
          className="mx-auto"
        />

        {/* Signals */}
        <Reveal className="mt-10 flex flex-wrap justify-center gap-2">
          {AI_SIGNALS.map((s) => (
            <span key={s} className="rounded-full border border-mint/25 bg-mint/10 px-3 py-1.5 text-sm text-mint">{s}</span>
          ))}
        </Reveal>

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          {/* Pipeline steps */}
          <Reveal stagger={0.1} className="flex flex-col gap-4">
            {AI_PIPELINE.map((step) => {
              const Icon = step.icon;
              const isRN = step.id === AI_PIPELINE.length;
              return (
                <div
                  key={step.id}
                  data-reveal
                  className={`group flex gap-4 rounded-2xl border p-5 transition-colors ${isRN ? "border-mint/40 bg-mint/[0.06]" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"}`}
                >
                  <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isRN ? "bg-mint text-midnight" : "bg-white/10 text-mint"}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mint">{step.eyebrow}</p>
                    <h3 className="mt-1 font-display text-lg font-medium text-white">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/65">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </Reveal>

          {/* Dashboard + checklist */}
          <div className="flex flex-col gap-6">
            <Reveal><AIMatchDashboard /></Reveal>
            <Reveal><RNReviewChecklist tone="dark" /></Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
