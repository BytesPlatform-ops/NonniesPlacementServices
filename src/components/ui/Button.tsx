import Link from "next/link";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "dark" | "outline-light";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight " +
  "transition-[transform,background-color,color,box-shadow] duration-200 ease-out " +
  "active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  // Coral is reserved for primary "Get started / Find Care" CTAs (§5)
  primary: "cta-shine bg-coral text-white shadow-soft hover:bg-coral-600 hover:shadow-card focus-visible:outline-coral",
  secondary: "bg-navy text-white hover:bg-navy-700 focus-visible:outline-navy",
  ghost: "bg-transparent text-navy hover:bg-ice focus-visible:outline-navy",
  dark: "bg-mint text-midnight hover:bg-aqua shadow-glow focus-visible:outline-mint",
  "outline-light":
    "border border-white/40 bg-white/5 text-white backdrop-blur-md hover:bg-white/15 focus-visible:outline-white",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-[0.95rem]",
  lg: "px-8 py-4 text-base",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", className, children } = props;
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if ("href" in props && props.href !== undefined) {
    const { href, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
    void _v; void _s; void _c; void _ch;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className: _c, children: _ch, href: _h, ...rest } =
    props as ButtonAsButton & { href?: undefined };
  void _v; void _s; void _c; void _ch; void _h;
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
