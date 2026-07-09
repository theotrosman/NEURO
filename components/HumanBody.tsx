"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LANDMARKS, Vec3 } from "../lib/body/landmarks";
import { useNeuro } from "./store";

const UP = new THREE.Vector3(0, 1, 0);

// Construye una capsula orientada entre dos puntos, en coordenadas relativas
// a un origen (la articulacion proximal alrededor de la cual pivota el hueso).
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

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

const GHOST = "#5f86ff";

export default function HumanBody() {
  const showBody = useNeuro((s) => s.showBody);
  const engine = useNeuro((s) => s.engine);
  const stimulate = useNeuro((s) => s.stimulate);

  // Cadena articulada: cada miembro tiene un segmento proximal (pivota en el
  // hombro/cadera) y un segmento distal encadenado que pivota en el codo/rodilla.
  const armLU = useRef<THREE.Group>(null); // brazo izq, hombro
  const armLE = useRef<THREE.Group>(null); // antebrazo izq, codo
  const armRU = useRef<THREE.Group>(null);
  const armRE = useRef<THREE.Group>(null);
  const legLU = useRef<THREE.Group>(null); // muslo izq, cadera
  const legLK = useRef<THREE.Group>(null); // pierna izq, rodilla
  const legRU = useRef<THREE.Group>(null);
  const legRK = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);

  // --- Ciclo de marcha: gobernado por gaitSnapshot (fase por distancia real,
  //     intensidad de locomocion, destreza). Las piernas van en antifase, las
  //     rodillas flexionan en la fase de balanceo, los brazos contrabalancean y
  //     la torpeza (baja destreza) agrega temblor. En reposo se funde a una
  //     postura de respiro con leves espasmos segun la salida motora neuronal. ---
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const g = engine?.gaitSnapshot();
    const m = engine?.motorSnapshot();

    const walk = g ? g.loco : 0; // 0..1 cuanto camina
    const idleW = 1 - walk;
    const skill = g ? g.skill : 0.3;
    const p = g ? g.phase : 0; // fase de la pierna izq. de referencia
    const pR = p + Math.PI; // pierna derecha en antifase
    const clumsy = (1 - skill) * walk; // temblor: alto si torpe, nulo experto

    // Amplitudes articulares (radianes).
    const hipAmp = 0.55;
    const kneeAmp = 1.15;
    const armAmp = 0.5;
    const elbowBase = 0.32;
    const elbowSwing = 0.4;

    const mArmL = m?.armL ?? 0;
    const mArmR = m?.armR ?? 0;
    const mLegL = m?.legL ?? 0;
    const mLegR = m?.legR ?? 0;
    const mCore = m?.core ?? 0;

    // --- Muslos (cadera): balanceo adelante/atras en antifase ---
    const legSwingL = -Math.sin(p) * hipAmp;
    const legSwingR = -Math.sin(pR) * hipAmp;
    const legIdleL = -mLegL * 0.45 + Math.sin(t * 1.05) * 0.02;
    const legIdleR = -mLegR * 0.45 - Math.sin(t * 1.05) * 0.02;
    const nLegL = clumsy * 0.18 * Math.sin(t * 8.7 + 0.5);
    const nLegR = clumsy * 0.18 * Math.sin(t * 8.1 + 2.7);
    if (legLU.current)
      legLU.current.rotation.x = legSwingL * walk + legIdleL * idleW + nLegL;
    if (legRU.current)
      legRU.current.rotation.x = legSwingR * walk + legIdleR * idleW + nLegR;

    // --- Rodillas: solo flexionan (positivo), maxima en balanceo para librar el
    //     suelo; extendidas en apoyo. Reposo casi recto. ---
    const kneeL = (Math.max(0, Math.cos(p)) * kneeAmp + 0.12) * walk + Math.abs(nLegL);
    const kneeR = (Math.max(0, Math.cos(pR)) * kneeAmp + 0.12) * walk + Math.abs(nLegR);
    if (legLK.current) legLK.current.rotation.x = kneeL;
    if (legRK.current) legRK.current.rotation.x = kneeR;

    // --- Brazos (hombro): contrabalanceo (opuesto a la pierna del mismo lado) ---
    const armSwingL = Math.sin(p) * armAmp;
    const armSwingR = Math.sin(pR) * armAmp;
    const armIdleL = -mArmL * 1.0 + Math.sin(t * 1.1) * 0.05;
    const armIdleR = -mArmR * 1.0 - Math.sin(t * 1.1) * 0.05;
    const nArmL = clumsy * 0.15 * Math.sin(t * 7.3 + 1.1);
    const nArmR = clumsy * 0.15 * Math.sin(t * 7.9 + 3.4);
    if (armLU.current)
      armLU.current.rotation.x = armSwingL * walk + armIdleL * idleW + nArmL;
    if (armRU.current)
      armRU.current.rotation.x = armSwingR * walk + armIdleR * idleW + nArmR;

    // --- Codos: siempre algo flexionados; mas cuando el brazo va adelante ---
    const elbowL = elbowBase + Math.max(0, -armSwingL / armAmp) * elbowSwing * walk;
    const elbowR = elbowBase + Math.max(0, -armSwingR / armAmp) * elbowSwing * walk;
    if (armLE.current) armLE.current.rotation.x = -elbowL;
    if (armRE.current) armRE.current.rotation.x = -elbowR;

    // --- Torso: respira y gira levemente al contrario del paso ---
    if (torso.current) {
      const breathe = 1 + Math.sin(t * 1.6) * 0.012 + mCore * 0.04;
      torso.current.scale.set(1, breathe, 1);
      torso.current.rotation.y = Math.sin(p) * 0.1 * walk;
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

  // Zona sensorial clicable (mano/pie/ojo): inyecta estimulo al receptor.
  const touch = (pos: Vec3, region: string, r: number, colr: string) => (
    <mesh
      position={pos}
      onClick={(e) => {
        e.stopPropagation();
        stimulate(region, 60);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
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

  // Miembro articulado de dos huesos: el segmento proximal pivota en `origin`
  // (hombro/cadera) y el distal, encadenado, pivota en `jointPos` (codo/rodilla).
  // La zona tactil (mano/pie) viaja con el segmento distal.
  const articLimb = (
    upperRef: React.RefObject<THREE.Group>,
    jointRef: React.RefObject<THREE.Group>,
    origin: Vec3,
    jointPos: Vec3,
    distalPos: Vec3,
    rUpper: number,
    rLower: number,
    touchRegion: string,
    touchR: number
  ) => {
    const upper = segment(origin, jointPos, origin);
    const jointLocal = sub(jointPos, origin);
    const lower = segment(jointPos, distalPos, jointPos);
    const touchLocal = sub(distalPos, jointPos);
    return (
      <group ref={upperRef} position={origin}>
        <mesh position={upper.pos} quaternion={upper.quat}>
          <capsuleGeometry args={[rUpper, upper.len, 4, 10]} />
          {skin}
        </mesh>
        <group ref={jointRef} position={jointLocal}>
          <mesh position={lower.pos} quaternion={lower.quat}>
            <capsuleGeometry args={[rLower, lower.len, 4, 10]} />
            {skin}
          </mesh>
          {touch(touchLocal, touchRegion, touchR, "#3cffd2")}
        </group>
      </group>
    );
  };

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

      {/* Miembros articulados (hombro->codo->mano, cadera->rodilla->pie) */}
      {articLimb(armLU, armLE, L.shoulderL, L.elbowL, L.handL, 0.5, 0.42, "skin_hand_L", 0.6)}
      {articLimb(armRU, armRE, L.shoulderR, L.elbowR, L.handR, 0.5, 0.42, "skin_hand_R", 0.6)}
      {articLimb(legLU, legLK, L.hipL, L.kneeL, L.footL, 0.72, 0.55, "skin_foot_L", 0.6)}
      {articLimb(legRU, legRK, L.hipR, L.kneeR, L.footR, 0.72, 0.55, "skin_foot_R", 0.6)}
    </group>
  );
}
