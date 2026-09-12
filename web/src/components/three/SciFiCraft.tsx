"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

/** Angular greeble craft — L3-family silhouette, built from boxes (no glTF). */
export function SciFiCraft({ spin = true }: { spin?: boolean }) {
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!spin || !ref.current) return;
    ref.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={ref} rotation={[0.18, 0.6, 0.04]}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[2.6, 0.38, 0.72]} />
        <meshStandardMaterial color="#8b929c" metalness={0.72} roughness={0.32} />
      </mesh>
      <mesh position={[0.95, 0.08, 0]} castShadow>
        <boxGeometry args={[0.9, 0.28, 0.5]} />
        <meshStandardMaterial color="#6f7782" metalness={0.65} roughness={0.38} />
      </mesh>
      <mesh position={[-1.15, 0.02, 0]} castShadow>
        <boxGeometry args={[0.55, 0.22, 0.42]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0.15, 0.22, 0]} castShadow>
        <boxGeometry args={[1.1, 0.16, 0.38]} />
        <meshStandardMaterial color="#5c6570" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.1, -0.02, 0.62]} castShadow>
        <boxGeometry args={[1.1, 0.08, 0.85]} />
        <meshStandardMaterial color="#7a828c" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0.1, -0.02, -0.62]} castShadow>
        <boxGeometry args={[1.1, 0.08, 0.85]} />
        <meshStandardMaterial color="#7a828c" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[1.45, -0.02, 0.22]}>
        <cylinderGeometry args={[0.09, 0.12, 0.28, 10]} />
        <meshStandardMaterial color="#c5d4e0" emissive="#8aa0b3" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[1.45, -0.02, -0.22]}>
        <cylinderGeometry args={[0.09, 0.12, 0.28, 10]} />
        <meshStandardMaterial color="#c5d4e0" emissive="#8aa0b3" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}
