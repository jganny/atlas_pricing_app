"use client";

import { Component, type ReactNode, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

class WebGlGate extends Component<{ children: ReactNode; onError: () => void }, { ok: boolean }> {
  state = { ok: true };
  static getDerivedStateFromError() {
    return { ok: false };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.ok ? this.props.children : null;
  }
}

function Cartons({ reduce }: { reduce: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (reduce || !ref.current) return;
    ref.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={ref} position={[0, -0.15, 0]}>
      <mesh position={[-0.22, 0.28, 0]} castShadow>
        <boxGeometry args={[0.72, 0.56, 0.58]} />
        <meshStandardMaterial color="#c4a574" roughness={0.72} metalness={0.04} />
      </mesh>
      <mesh position={[0.38, 0.2, 0.08]} castShadow>
        <boxGeometry args={[0.42, 0.4, 0.4]} />
        <meshStandardMaterial color="#b08d5c" roughness={0.74} metalness={0.04} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[0.95, 28]} />
        <meshStandardMaterial color="#e8eef2" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function CartonTokens() {
  const [failed, setFailed] = useState(false);
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (failed) {
    return (
      <div
        data-testid="home-3d-cartons"
        className="flex h-[8.5rem] items-end justify-center rounded-2xl bg-[var(--color-surface-muted)] px-3 pb-3 text-center text-[11px] font-semibold text-[var(--color-text-muted)]"
      >
        3D cartons
      </div>
    );
  }

  return (
    <div
      data-testid="home-3d-cartons"
      className="h-[8.5rem] overflow-hidden rounded-2xl bg-gradient-to-b from-white to-[#e8eef2]"
      aria-hidden
    >
      <WebGlGate onError={() => setFailed(true)}>
        <Canvas
          camera={{ position: [1.6, 1.15, 1.8], fov: 40 }}
          shadows
          gl={{ antialias: true, failIfMajorPerformanceCaveat: false, powerPreference: "default" }}
          onCreated={({ gl }) => {
            if (!gl.getContext()) setFailed(true);
          }}
        >
          <color attach="background" args={["#f4f7fa"]} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[3, 4, 2]} intensity={1.15} castShadow />
          <Cartons reduce={reduce} />
        </Canvas>
      </WebGlGate>
    </div>
  );
}
