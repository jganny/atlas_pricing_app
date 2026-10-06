"use client";

import { Component, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BoxGeometry, InstancedMesh, Object3D } from "three";
import type { ContainerSpec, Packing } from "@/lib/pricing/container-load";

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

function Shell({ spec }: { spec: ContainerSpec }) {
  const edges = useMemo(() => new BoxGeometry(spec.length, spec.height, spec.width), [spec]);
  return (
    <group position={[0, spec.height / 2, 0]}>
      <lineSegments>
        <edgesGeometry args={[edges]} />
        <lineBasicMaterial color="#5B6472" />
      </lineSegments>
      <mesh>
        <boxGeometry args={[spec.length, spec.height, spec.width]} />
        <meshStandardMaterial color="#9fb3cc" transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Cargo({ spec, packing }: { spec: ContainerSpec; packing: Packing }) {
  const ref = useRef<InstancedMesh>(null);
  // Only what physically fits in this one container is drawn; the rest is "needs another".
  const drawn = useMemo(
    () => packing.boxes.filter((b) => b.x + b.l / 2 <= spec.length + 1e-6),
    [packing, spec.length],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    drawn.forEach((b, i) => {
      o.position.set(b.x - spec.length / 2, b.y, b.z);
      o.scale.set(b.l * 0.96, b.h * 0.96, b.w * 0.96);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.count = drawn.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [drawn, spec.length]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, drawn.length)]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#d79b4f" roughness={0.75} metalness={0.03} />
    </instancedMesh>
  );
}

export function ContainerLoad3D({ spec, packing }: { spec: ContainerSpec; packing: Packing }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl bg-slate-50 text-xs font-semibold text-[var(--color-text-muted)]">
        3D view isn&apos;t available on this device — the numbers below still apply.
      </div>
    );
  }

  return (
    <div
      data-testid="container-load-3d"
      className="h-56 overflow-hidden rounded-xl bg-gradient-to-b from-white to-[#e8eef2]"
    >
      <WebGlGate onError={() => setFailed(true)}>
        <Canvas camera={{ position: [spec.length * 0.7, spec.length * 0.6, spec.length * 1.3], fov: 38 }}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[6, 10, 6]} intensity={1.1} />
          <Shell spec={spec} />
          <Cargo spec={spec} packing={packing} />
          <OrbitControls enablePan={false} minDistance={5} maxDistance={40} target={[0, spec.height / 2, 0]} />
        </Canvas>
      </WebGlGate>
    </div>
  );
}
