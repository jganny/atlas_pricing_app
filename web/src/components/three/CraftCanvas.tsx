"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { SciFiCraft } from "./SciFiCraft";

export function CraftCanvas() {
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      data-testid="threejs-canvas"
      className="h-[22rem] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-b from-[#d7e6f2] to-[#8eb4c8]"
    >
      <Canvas camera={{ position: [3.2, 1.6, 4.2], fov: 42 }} shadows>
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
    </div>
  );
}
