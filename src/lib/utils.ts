import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True on the server or before hydration. Guard browser-only APIs with this. */
export const isBrowser = typeof window !== "undefined";

/** Read the user's reduced-motion preference synchronously (browser only). */
export function prefersReducedMotion(): boolean {
  if (!isBrowser || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Clamp helper. */
export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
