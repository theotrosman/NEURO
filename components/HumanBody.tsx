"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LANDMARKS, Vec3 } from "../lib/body/landmarks";
import { useNeuro } from "./store";

const UP = new THREE.Vector3(0, 1, 0);

// Construye una capsula orientada entre dos puntos, en coordenadas relativas
// a un origen (la articulacion proximal alrededor de la cual pivota el miembro).
function segment(from: Vec3, to: Vec3, origin: Vec3) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mid.sub(new THREE.Vector3(...origin));
  return {
    pos: [mid.x, mid.y, mid.z] as [number, number, number],
    quat: [quat.x, quat.y, quat.z, quat.w] as [number, number, number, number],
    len,
  };
}

const GHOST = "#5f86ff";

export default function HumanBody() {
  const showBody = useNeuro((s) => s.showBody);
  const engine = useNeuro((s) => s.engine);
  const stimulate = useNeuro((s) => s.stimulate);

  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);

  const limbs = useMemo(() => {
    const L = LANDMARKS;
    return {
      armL: {
        origin: L.shoulderL,
        upper: segment(L.shoulderL, L.elbowL, L.shoulderL),
        lower: segment(L.elbowL, L.handL, L.shoulderL),
        rUpper: 0.5, rLower: 0.42,
      },
      armR: {
        origin: L.shoulderR,
        upper: segment(L.shoulderR, L.elbowR, L.shoulderR),
        lower: segment(L.elbowR, L.handR, L.shoulderR),
        rUpper: 0.5, rLower: 0.42,
      },
      legL: {
        origin: L.hipL,
        upper: segment(L.hipL, L.kneeL, L.hipL),
        lower: segment(L.kneeL, L.footL, L.hipL),
        rUpper: 0.72, rLower: 0.55,
      },
      legR: {
        origin: L.hipR,
        upper: segment(L.hipR, L.kneeR, L.hipR),
        lower: segment(L.kneeR, L.footR, L.hipR),
        rUpper: 0.72, rLower: 0.55,
      },
    };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const m = engine?.motorSnapshot();
    const idle = Math.sin(t * 1.1) * 0.05;
    if (armL.current) armL.current.rotation.x = -(m?.armL ?? 0) * 1.1 + idle;
    if (armR.current) armR.current.rotation.x = -(m?.armR ?? 0) * 1.1 - idle;
    if (legL.current) legL.current.rotation.x = (m?.legL ?? 0) * 0.7 - idle;
    if (legR.current) legR.current.rotation.x = (m?.legR ?? 0) * 0.7 + idle;
    if (torso.current) {
      const breathe = 1 + Math.sin(t * 1.6) * 0.012 + (m?.core ?? 0) * 0.04;
      torso.current.scale.set(1, breathe, 1);
    }
  });

  if (!showBody) return null;

  const L = LANDMARKS;

  const skin = (
    <meshStandardMaterial
      color={GHOST}
      transparent
      opacity={0.17}
      roughness={0.35}
      metalness={0.1}
      emissive={GHOST}
      emissiveIntensity={0.25}
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  );

  // Malla de alambre para dar una silueta holografica al cuerpo.
  const wire = (
    <meshBasicMaterial
      color="#7fb0ff"
      wireframe
      transparent
      opacity={0.14}
      depthWrite={false}
      toneMapped={false}
    />
  );

  const renderLimb = (
    ref: React.RefObject<THREE.Group>,
    limb: (typeof limbs)[keyof typeof limbs]
  ) => (
    <group ref={ref} position={limb.origin}>
      <mesh position={limb.upper.pos} quaternion={limb.upper.quat}>
        <capsuleGeometry args={[limb.rUpper, limb.upper.len, 4, 10]} />
        {skin}
      </mesh>
      <mesh position={limb.lower.pos} quaternion={limb.lower.quat}>
        <capsuleGeometry args={[limb.rLower, limb.lower.len, 4, 10]} />
        {skin}
      </mesh>
    </group>
  );

  // Zona sensorial clicable (mano/pie/ojo): inyecta estimulo al receptor.
  const touch = (pos: Vec3, region: string, r: number, colr: string) => (
    <mesh
      position={pos}
      onClick={(e) => {
        e.stopPropagation();
        stimulate(region, 60);
      }}
      onPointerOver={(e) => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <sphereGeometry args={[r, 12, 12]} />
      <meshStandardMaterial
        color={colr}
        transparent
        opacity={0.28}
        emissive={colr}
        emissiveIntensity={0.5}
        depthWrite={false}
      />
    </mesh>
  );

  return (
    <group>
      {/* Cabeza translucida: deja ver el cerebro */}
      <mesh position={L.headCenter}>
        <sphereGeometry args={[2.35, 24, 24]} />
        {skin}
      </mesh>
      <mesh position={L.headCenter}>
        <sphereGeometry args={[2.36, 18, 14]} />
        {wire}
      </mesh>

      {/* Ojos (clic = estimulo visual) */}
      {touch(L.eyeL, "retina_L", 0.34, "#3cffd2")}
      {touch(L.eyeR, "retina_R", 0.34, "#3cffd2")}

      {/* Cuello */}
      <mesh position={[0, 11.1, 0]}>
        <cylinderGeometry args={[0.7, 0.8, 2.2, 12]} />
        {skin}
      </mesh>

      {/* Torso (respira) */}
      <group ref={torso}>
        <mesh position={[0, 6.2, 0]}>
          <capsuleGeometry args={[1.9, 4.4, 6, 16]} />
          {skin}
        </mesh>
        <mesh position={[0, 6.2, 0]}>
          <capsuleGeometry args={[1.92, 4.4, 4, 12]} />
          {wire}
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[1.7, 16, 16]} />
          {skin}
        </mesh>
      </group>

      {/* Miembros (se mueven con la salida motora) */}
      {renderLimb(armL, limbs.armL)}
      {renderLimb(armR, limbs.armR)}
      {renderLimb(legL, limbs.legL)}
      {renderLimb(legR, limbs.legR)}

      {/* Zonas sensoriales tactiles */}
      {touch(L.handL, "skin_hand_L", 0.6, "#3cffd2")}
      {touch(L.handR, "skin_hand_R", 0.6, "#3cffd2")}
      {touch(L.footL, "skin_foot_L", 0.6, "#3cffd2")}
      {touch(L.footR, "skin_foot_R", 0.6, "#3cffd2")}
    </group>
  );
}
