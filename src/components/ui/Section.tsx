import { cn } from "@/lib/utils";
import { Container } from "./Container";

type Tone = "light" | "ice" | "dark" | "transparent";
type Density = "normal" | "dense" | "spacious";

const TONES: Record<Tone, string> = {
  light: "bg-ivory text-[#2b1b0e]",
  ice: "bg-ice text-[#2b1b0e]",
  dark: "bg-midnight text-white",
  transparent: "",
};

// Spacing rules: normal 56→88→112px, dense 48→64→88px, spacious 64→96→120px.
const DENSITY: Record<Density, string> = {
  normal: "py-14 sm:py-[88px] lg:py-28",
  dense: "py-12 sm:py-16 lg:py-[88px]",
  spacious: "py-16 sm:py-24 lg:py-[120px]",
};

export function Section({
  id,
  tone = "light",
  density = "normal",
  className,
  containerClassName,
  contained = true,
  children,
}: {
  id?: string;
  tone?: Tone;
  density?: Density;
  className?: string;
  containerClassName?: string;
  contained?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("relative", DENSITY[density], TONES[tone], className)}
      style={id ? { scrollMarginTop: "5rem" } : undefined}
    >
      {contained ? <Container className={containerClassName}>{children}</Container> : children}
    </section>
  );
}
