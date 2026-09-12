"use client";

import { Component, type ReactNode, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
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

function OceanStage({ reduce }: { reduce: boolean }) {
  return (
    <>
      <Sky sunPosition={[80, 18, 40]} turbidity={3.4} rayleigh={0.55} mieCoefficient={0.004} />
      <fog attach="fog" args={["#c9e2f0", 18, 55]} />
      <hemisphereLight args={["#fff6e8", "#4d7a8c", 0.55]} />
      <directionalLight position={[12, 10, 4]} intensity={1.55} castShadow color="#fff4d6" />
      <ambientLight intensity={0.35} />
      <SciFiCraft spin={false} float={!reduce} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]} receiveShadow>
        <circleGeometry args={[48, 64]} />
        <meshStandardMaterial color="#4e93b0" roughness={0.28} metalness={0.18} />
      </mesh>
      {/* Far coast / road wash — keeps L3 daylight, not a busy map */}
      <mesh rotation={[-Math.PI / 2.15, 0, 0.18]} position={[14, -0.95, -6]} receiveShadow>
        <planeGeometry args={[22, 10]} />
        <meshStandardMaterial color="#cbbba3" roughness={0.9} />
      </mesh>
    </>
  );
}

export function HubHero() {
  const [failed, setFailed] = useState(false);
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (failed) {
    return (
      <div
        data-testid="quote-hub-3d"
        className="absolute inset-0 bg-gradient-to-br from-[#d7eaf6] via-[#8eb9d0] to-[#e8d9c0]"
        aria-hidden
      />
    );
  }

  return (
    <div data-testid="quote-hub-3d" className="pointer-events-none absolute inset-0" aria-hidden>
      <WebGlGate onError={() => setFailed(true)}>
        <Canvas
          camera={{ position: [5.6, 1.9, 7.4], fov: 38 }}
          shadows
          gl={{ antialias: true, failIfMajorPerformanceCaveat: false, powerPreference: "default" }}
          onCreated={({ gl, camera }) => {
            const ctx = gl.getContext();
            if (!ctx) setFailed(true);
            camera.lookAt(-1.2, 0.15, 0);
          }}
        >
          <OceanStage reduce={reduce} />
        </Canvas>
      </WebGlGate>
    </div>
  );
}
