import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/layout/LogoMark";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[80svh] items-center overflow-hidden bg-midnight text-white">
      <div className="pointer-events-none absolute inset-0 hero-gradient-fallback opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-midnight/50" />
      <Container className="relative text-center">
        <LogoMark className="mx-auto h-16 w-16" />
        <p className="mt-8 font-display text-7xl font-semibold text-mint">404</p>
        <h1 className="mt-4 font-display text-3xl font-medium">This page took a different path</h1>
        <p className="mx-auto mt-3 max-w-md text-white/70">
          The page you&apos;re looking for isn&apos;t here — but we can still help you find the right care.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/" variant="dark" size="lg">
            Back to home
          </Button>
          <Button href="/contact" variant="outline-light" size="lg">
            Contact us
          </Button>
        </div>
        <p className="mt-6 text-sm text-white/50">
          Or jump to{" "}
          <Link href="/families" className="text-mint underline-offset-4 hover:underline">
            Families
          </Link>{" "}
          ·{" "}
          <Link href="/providers" className="text-mint underline-offset-4 hover:underline">
            Providers
          </Link>
        </p>
      </Container>
    </section>
  );
}
