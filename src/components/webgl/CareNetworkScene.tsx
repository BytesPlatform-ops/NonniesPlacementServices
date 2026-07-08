"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { LivingGradientMesh } from "./LivingGradientMesh";

/**
 * Care Network scene (§WebGL). Over the animated gradient backdrop: a 3D graph
 * of family / hospital / RN / provider nodes, glowing connection lines, and a
 * drifting particle field. The RN hub sits at the center — the whole scene says
 * "families + hospitals + providers connected by RN-reviewed matching."
 * Slow auto-rotation + cursor parallax. Low geometry; bloom added in the canvas.
 */

const COLORS = {
  rn: new THREE.Color("#d18f47"),
  family: new THREE.Color("#b56f28"),
  hospital: new THREE.Color("#8e6d49"),
  provider: new THREE.Color("#e2b483"),
};

type Node = { pos: [number, number, number]; role: keyof typeof COLORS; size: number };

const NODES: Node[] = [
  { pos: [0, 0, 0], role: "rn", size: 0.17 },
  { pos: [-2.1, 1.0, -0.4], role: "family", size: 0.1 },
  { pos: [-2.4, -0.8, 0.6], role: "family", size: 0.085 },
  { pos: [-1.3, -1.6, -0.8], role: "family", size: 0.08 },
  { pos: [2.2, 1.1, -0.3], role: "hospital", size: 0.1 },
  { pos: [2.5, -0.6, 0.5], role: "hospital", size: 0.085 },
  { pos: [1.2, 1.8, 0.7], role: "hospital", size: 0.08 },
  { pos: [0.4, -2.0, -0.5], role: "provider", size: 0.1 },
  { pos: [-0.7, 1.9, -0.6], role: "provider", size: 0.085 },
  { pos: [1.7, -1.6, -0.7], role: "provider", size: 0.08 },
  { pos: [-1.9, 0.2, 1.1], role: "provider", size: 0.075 },
];

function Network() {
  const group = useRef<THREE.Group>(null);
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const hub = NODES[0];

  // Base offset so the constellation sits to the right, behind the hero media.
  const BASE_X = 1.35;
  const BASE_Y = 0.25;

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    // Slow auto-rotation.
    g.rotation.y += delta * 0.05;
    // Cursor parallax (eased) around the base offset.
    const px = BASE_X + state.pointer.x * 0.2;
    const py = state.pointer.y * 0.18;
    g.rotation.x += (py - g.rotation.x) * 0.04;
    g.position.x += (px - g.position.x) * 0.04;
    g.position.y = BASE_Y;
    // Gentle node pulse.
    const t = state.clock.elapsedTime;
    nodeRefs.current.forEach((m, i) => {
      if (!m) return;
      const s = 1 + Math.sin(t * 1.4 + i) * 0.05;
      m.scale.setScalar(s);
    });
  });

  return (
    <group ref={group} position={[BASE_X, BASE_Y, 0]} scale={0.92}>
      {/* Connection lines: hub → every node */}
      {NODES.slice(1).map((n, i) => (
        <Line
          key={`line-${i}`}
          points={[hub.pos, n.pos]}
          color={COLORS[n.role].getStyle()}
          lineWidth={0.7}
          transparent
          opacity={0.26}
          depthWrite={false}
        />
      ))}
      {/* A few cross links for richness */}
      <Line points={[NODES[1].pos, NODES[8].pos]} color="#b56f28" lineWidth={0.6} transparent opacity={0.18} depthWrite={false} />
      <Line points={[NODES[4].pos, NODES[9].pos]} color="#d18f47" lineWidth={0.6} transparent opacity={0.18} depthWrite={false} />

      {/* Nodes */}
      {NODES.map((n, i) => (
        <mesh key={`node-${i}`} position={n.pos} ref={(el) => { nodeRefs.current[i] = el; }}>
          <icosahedronGeometry args={[n.size, 2]} />
          <meshBasicMaterial color={COLORS[n.role]} toneMapped={false} />
          {n.role === "rn" && (
            <mesh>
              <icosahedronGeometry args={[n.size * 1.35, 2]} />
              <meshBasicMaterial color={COLORS.rn} transparent opacity={0.08} toneMapped={false} />
            </mesh>
          )}
        </mesh>
      ))}
    </group>
  );
}

export function CareNetworkScene() {
  return (
    <group>
      <LivingGradientMesh renderOrder={-10} />
      <Network />
    </group>
  );
}
