"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import BrainView from "./BrainView";
import HumanBody from "./HumanBody";
import { useNeuro } from "./store";

export default function Scene() {
  const setSelected = useNeuro((s) => s.setSelected);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [7, 2, 44], fov: 42, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color("#05060d");
        scene.fog = new THREE.Fog("#05060d", 45, 140);
      }}
      onPointerMissed={() => setSelected(null)}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[10, 20, 15]} intensity={0.8} />
      <pointLight position={[-15, 5, 10]} intensity={120} color="#4a70ff" />
      <pointLight position={[15, -5, -10]} intensity={80} color="#ff4a70" />

      <BrainView />
      <HumanBody />

      <OrbitControls
        target={[0, 1, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={90}
      />
    </Canvas>
  );
}
