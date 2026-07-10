"use client";

import { ReactNode, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import BrainView from "./BrainView";
import HumanBody from "./HumanBody";
import World from "./World";
import { useNeuro } from "./store";

// Agrupa cuerpo + cerebro y los coloca en el mundo segun la posicion y
// orientacion del agente (que la simulacion actualiza cada paso).
function AgentRig({ children }: { children: ReactNode }) {
  const engine = useNeuro((s) => s.engine);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!engine || !ref.current) return;
    const a = engine.agent;
    ref.current.position.set(a.x, 0, a.z);
    ref.current.rotation.y = a.heading;
  });
  return <group ref={ref}>{children}</group>;
}

// Postura dinamica del cuerpo entero (cerebro + cuerpo juntos, para que la
// cabeza y el cerebro reboten con el andar). Da la sensacion de peso/gravedad,
// pero ya NO la dibuja: la toma directa del cuerpo neuromecanico. El rebote (el
// centro de masa que sube en el apoyo), el balanceo hacia la pierna que
// sostiene, la inclinacion sagital del pendulo invertido y el desplome al caer/
// dormir son magnitudes FISICAS reales, calculadas por la gravedad y el
// equilibrio. El render solo las aplica: el peso se siente porque existe.
function BodyPosture({ children }: { children: ReactNode }) {
  const engine = useNeuro((s) => s.engine);
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const g = engine?.gaitSnapshot();
    if (!g) return;
    ref.current.position.y = g.bob;
    ref.current.position.x = g.sway;
    ref.current.rotation.z = g.roll;
    ref.current.rotation.x = g.lean;
  });

  return <group ref={ref}>{children}</group>;
}

// La camara sigue al cuerpo: suma el desplazamiento del agente a la posicion de
// la camara y al objetivo de orbita, de modo que uno puede seguir orbitando y
// haciendo zoom mientras el cuerpo se desplaza por el terreno.
function FollowCam() {
  const engine = useNeuro((s) => s.engine);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
  } | null;
  const prev = useRef<{ x: number; z: number } | null>(null);

  useFrame(({ camera }) => {
    if (!engine) return;
    const a = engine.agent;
    if (prev.current) {
      const dx = a.x - prev.current.x;
      const dz = a.z - prev.current.z;
      if (dx !== 0 || dz !== 0) {
        camera.position.x += dx;
        camera.position.z += dz;
        if (controls && controls.target) {
          controls.target.x += dx;
          controls.target.z += dz;
        }
      }
      prev.current.x = a.x;
      prev.current.z = a.z;
    } else {
      prev.current = { x: a.x, z: a.z };
    }
  });
  return null;
}

export default function Scene() {
  const setSelected = useNeuro((s) => s.setSelected);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [7, 6, 44], fov: 42, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color("#05060d");
        scene.fog = new THREE.Fog("#05060d", 55, 170);
      }}
      onPointerMissed={() => setSelected(null)}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[-15, 5, 10]} intensity={120} color="#4a70ff" />
      <pointLight position={[15, -5, -10]} intensity={80} color="#ff4a70" />

      <World />

      <AgentRig>
        <BodyPosture>
          <BrainView />
          <HumanBody />
        </BodyPosture>
      </AgentRig>

      <FollowCam />

      <OrbitControls
        makeDefault
        target={[0, 1, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={120}
      />
    </Canvas>
  );
}
