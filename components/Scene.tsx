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
// cabeza y el cerebro reboten con el andar). Da la sensacion de peso/gravedad:
//   - rebote vertical que sube en el apoyo medio de cada paso (2 por zancada),
//   - balanceo lateral hacia la pierna que sostiene,
//   - leve alabeo e inclinacion hacia adelante al caminar,
//   - desplome relajado al dormir.
// Todo se funde suavemente porque la intensidad (loco) ya viene suavizada del
// motor y el "dormido" se interpola aqui.
function BodyPosture({ children }: { children: ReactNode }) {
  const engine = useNeuro((s) => s.engine);
  const ref = useRef<THREE.Group>(null);
  const slept = useRef(0);

  useFrame(() => {
    if (!ref.current) return;
    const g = engine?.gaitSnapshot();
    const walk = g ? g.loco : 0;
    const p = g ? g.phase : 0;
    const asleep = g ? g.asleep : false;

    // Rebote vertical: maximo en apoyo medio (fase 0 y pi), reposo en el choque
    // de talon (fase pi/2, 3pi/2). Siempre >= 0: el cuerpo se impulsa hacia
    // arriba en cada paso y nunca se hunde en el suelo.
    const bob = 0.8 * (0.5 + 0.5 * Math.cos(2 * p)) * walk;
    // Balanceo lateral hacia la pierna de apoyo (una vez por zancada).
    const sway = 0.6 * Math.cos(p) * walk;
    // Ligero alabeo acompanando el balanceo e inclinacion al avanzar.
    const roll = -0.05 * Math.cos(p) * walk;
    const lean = 0.07 * walk;

    // Desplome suave al dormir (postura relajada, cabeza baja).
    slept.current += ((asleep ? 1 : 0) - slept.current) * 0.05;
    const s = slept.current;

    ref.current.position.y = bob - 1.0 * s;
    ref.current.position.x = sway;
    ref.current.rotation.z = roll;
    ref.current.rotation.x = lean + 0.16 * s;
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
