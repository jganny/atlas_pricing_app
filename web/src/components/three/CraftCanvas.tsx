"use client";

import { Component, type ReactNode, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { SciFiCraft } from "./SciFiCraft";

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

export function CraftCanvas() {
  const [failed, setFailed] = useState(false);
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (failed) {
    return (
      <div
        data-testid="threejs-canvas"
        className="flex h-[22rem] items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[#cfe0ec] px-6 text-center text-sm font-semibold text-[var(--color-atlas-navy)]"
      >
        Three.js needs WebGL (the graphics chip). This machine blocked it; your normal Chrome should
        show a spinning craft here.
      </div>
    );
  }

  return (
    <div
      data-testid="threejs-canvas"
      className="h-[22rem] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-b from-[#d7e6f2] to-[#8eb4c8]"
    >
      <WebGlGate onError={() => setFailed(true)}>
        <Canvas
          camera={{ position: [3.2, 1.6, 4.2], fov: 42 }}
          shadows
          gl={{ antialias: true, failIfMajorPerformanceCaveat: false, powerPreference: "default" }}
          onCreated={({ gl }) => {
            const ctx = gl.getContext();
            if (!ctx) setFailed(true);
          }}
        >
          <color attach="background" args={["#cfe0ec"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[6, 8, 4]} intensity={1.35} castShadow />
          <hemisphereLight args={["#f4f7fb", "#6b8499", 0.35]} />
          <SciFiCraft spin={!reduce} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]} receiveShadow>
            <circleGeometry args={[6, 40]} />
            <meshStandardMaterial color="#7eacbf" roughness={0.85} />
          </mesh>
          <OrbitControls enablePan={false} minDistance={3} maxDistance={8} />
        </Canvas>
      </WebGlGate>
    </div>
  );
}
