"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Living Gradient Mesh (§3.7 Option 1). A fullscreen shader quad — navy → teal
 * → mint blobs drifting via simplex noise, breathing slowly and warping gently
 * toward the cursor. Low geometry (one triangle-pair), no post-processing here.
 */

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Fullscreen quad, independent of camera.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uAspect;
  uniform vec3 uNavy;
  uniform vec3 uBlue;
  uniform vec3 uTeal;
  uniform vec3 uMint;

  // Ashima simplex noise 3D
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p){
    float f = 0.0;
    f += 0.5000 * snoise(p); p *= 2.02;
    f += 0.2500 * snoise(p); p *= 2.03;
    f += 0.1250 * snoise(p);
    return f;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv;
    p.x *= uAspect;

    float t = uTime * 0.05;
    // Gentle warp toward the cursor.
    vec2 m = uMouse * 0.12;
    p += m;

    float n1 = fbm(vec3(p * 1.6, t));
    float n2 = fbm(vec3(p * 2.4 + 4.0, t * 1.3 + 2.0));
    float blend = smoothstep(-0.6, 0.8, n1);
    float blend2 = smoothstep(-0.5, 0.9, n2);

    vec3 col = mix(uNavy, uBlue, blend);
    col = mix(col, uTeal, blend2 * 0.75);
    // Mint highlights where noise peaks — the "alive" glow.
    float glow = smoothstep(0.55, 0.95, n1 * 0.6 + n2 * 0.6);
    col = mix(col, uMint, glow * 0.5);

    // Radial vignette toward midnight for text contrast.
    float vig = smoothstep(1.25, 0.25, distance(uv, vec2(0.5)));
    col = mix(uNavy * 0.5, col, vig);

    // Subtle film grain.
    float grain = fract(sin(dot(uv * uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * 0.025;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function LivingGradientMesh({ renderOrder = 0 }: { renderOrder?: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const mouse = useRef(new THREE.Vector2(0, 0));
  const target = useRef(new THREE.Vector2(0, 0));
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uAspect: { value: size.width / size.height },
      uNavy: { value: new THREE.Color("#2b1b0e") },
      uBlue: { value: new THREE.Color("#472e16") },
      uTeal: { value: new THREE.Color("#b56f28") },
      uMint: { value: new THREE.Color("#d18f47") },
    }),
    // uniforms object is created once; aspect updated in useFrame
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    // Pointer in -1..1 (drei/r3f provides normalized pointer).
    target.current.set(state.pointer.x, state.pointer.y);
    mouse.current.lerp(target.current, Math.min(1, delta * 2));
    mat.uniforms.uTime.value += delta;
    mat.uniforms.uMouse.value.copy(mouse.current);
    mat.uniforms.uAspect.value = state.size.width / state.size.height;
  });

  return (
    <mesh frustumCulled={false} renderOrder={renderOrder}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
