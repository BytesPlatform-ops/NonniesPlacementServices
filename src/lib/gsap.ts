/**
 * Central GSAP registry. Import { gsap, ScrollTrigger } from here so plugins
 * are registered exactly once, on the client. (§11)
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

let registered = false;

export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  // SplitText / DrawSVG are registered lazily where used to keep this light.
  registered = true;
}

registerGsap();

export { gsap, ScrollTrigger, useGSAP };
