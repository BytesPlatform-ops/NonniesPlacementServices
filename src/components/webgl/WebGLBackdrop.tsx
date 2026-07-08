"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { StaticHeroPoster } from "./StaticHeroPoster";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useIsClient } from "@/hooks/useMediaQuery";

// Lazy-load the Three.js canvas AFTER first paint (§3.7.2). ssr:false so it
// never runs on the server; poster shows until it loads.
const CareNetworkCanvas = dynamic(() => import("./CareNetworkCanvas"), {
  ssr: false,
  loading: () => <StaticHeroPoster />,
});

class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <StaticHeroPoster />;
    return this.props.children;
  }
}

/**
 * Reusable WebGL backdrop (hero + AI showcase). Renders the Care Network scene
 * on capable desktops; a static animated-gradient poster on mobile / reduced-
 * motion / WebGL failure. `bloom` off for secondary instances to stay light.
 */
export function WebGLBackdrop({
  bloom = true,
  overlay = "hero",
}: {
  bloom?: boolean;
  overlay?: "hero" | "soft" | "none";
}) {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const isClient = useIsClient();
  const useWebGL = isClient && !isMobile && !reduced;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {useWebGL ? (
        <WebGLBoundary>
          <CareNetworkCanvas bloom={bloom} />
        </WebGLBoundary>
      ) : (
        <StaticHeroPoster />
      )}
      {overlay === "hero" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-midnight/50 via-midnight/25 to-midnight/75" />
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_40%,transparent,rgba(43,27,14,0.5))]" />
        </>
      )}
      {overlay === "soft" && <div className="absolute inset-0 bg-midnight/55" />}
    </div>
  );
}
