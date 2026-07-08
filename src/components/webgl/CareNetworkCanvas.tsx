"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { CareNetworkScene } from "./CareNetworkScene";

/**
 * Canvas host for the Care Network scene. Camera pulled back to frame the graph;
 * subtle Bloom + Vignette for the premium glow. PerformanceMonitor drops DPR and
 * disables post-processing on weak devices (§3.7.2). Post-processing is minimal.
 */
export default function CareNetworkCanvas({ bloom = true }: { bloom?: boolean }) {
  const [dpr, setDpr] = useState(bloom ? 1.5 : 1.25);
  const [fx, setFx] = useState(bloom);

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0, 6.6], fov: 45 }}
      gl={{ powerPreference: "high-performance", antialias: false, stencil: false, depth: true, alpha: false }}
      className="absolute inset-0"
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          setFx(false);
        }}
      >
        <CareNetworkScene />
        {fx && (
          <EffectComposer>
            <Bloom intensity={0.42} luminanceThreshold={0.42} luminanceSmoothing={0.25} mipmapBlur radius={0.5} />
            <Vignette eskil={false} offset={0.3} darkness={0.7} />
          </EffectComposer>
        )}
      </PerformanceMonitor>
    </Canvas>
  );
}
