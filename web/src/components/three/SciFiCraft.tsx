"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

/** Angular greeble craft — L3-family silhouette, built from boxes (no glTF). */
export function SciFiCraft({
  spin = false,
  float = false,
}: {
  spin?: boolean;
  float?: boolean;
}) {
  const ref = useRef<Group>(null);

  useFrame((state, delta) => {
    if (!ref.current) return;
    if (spin) ref.current.rotation.y += delta * 0.35;
    if (float) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.12;
    }
  });

  return (
    <group ref={ref} rotation={[0.12, 0.55, 0.06]}>
      {/* Fuselage */}
      <mesh position={[0.1, 0.06, 0]} castShadow>
        <boxGeometry args={[3.4, 0.42, 0.68]} />
        <meshStandardMaterial color="#c5ced6" metalness={0.78} roughness={0.28} />
      </mesh>
      {/* Nose */}
      <mesh position={[1.85, 0.04, 0]} castShadow>
        <boxGeometry args={[0.7, 0.3, 0.42]} />
        <meshStandardMaterial color="#9aa4ae" metalness={0.7} roughness={0.32} />
      </mesh>
      <mesh position={[2.28, 0.02, 0]} castShadow>
        <boxGeometry args={[0.28, 0.18, 0.22]} />
        <meshStandardMaterial color="#7d868f" metalness={0.65} roughness={0.35} />
      </mesh>
      {/* Dorsal ridge */}
      <mesh position={[-0.15, 0.32, 0]} castShadow>
        <boxGeometry args={[1.6, 0.18, 0.28]} />
        <meshStandardMaterial color="#6f7882" metalness={0.62} roughness={0.38} />
      </mesh>
      {/* Delta wings */}
      <mesh position={[-0.15, -0.02, 0.95]} rotation={[0.08, 0.12, -0.08]} castShadow>
        <boxGeometry args={[1.8, 0.07, 1.35]} />
        <meshStandardMaterial color="#b7c0c8" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.15, -0.02, -0.95]} rotation={[-0.08, -0.12, 0.08]} castShadow>
        <boxGeometry args={[1.8, 0.07, 1.35]} />
        <meshStandardMaterial color="#b7c0c8" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Wing greebles */}
      <mesh position={[0.35, 0.06, 1.35]} castShadow>
        <boxGeometry args={[0.45, 0.12, 0.38]} />
        <meshStandardMaterial color="#8b949d" metalness={0.55} roughness={0.42} />
      </mesh>
      <mesh position={[0.35, 0.06, -1.35]} castShadow>
        <boxGeometry args={[0.45, 0.12, 0.38]} />
        <meshStandardMaterial color="#8b949d" metalness={0.55} roughness={0.42} />
      </mesh>
      {/* Twin engines */}
      <mesh position={[-1.85, 0.02, 0.22]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.16, 0.55, 12]} />
        <meshStandardMaterial color="#d7e4ee" emissive="#9ec4dc" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[-1.85, 0.02, -0.22]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.16, 0.55, 12]} />
        <meshStandardMaterial color="#d7e4ee" emissive="#9ec4dc" emissiveIntensity={0.85} />
      </mesh>
      <pointLight position={[-2.2, 0.02, 0]} intensity={2.4} color="#cfe8ff" distance={6} />
    </group>
  );
}
