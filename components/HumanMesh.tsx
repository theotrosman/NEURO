"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { LANDMARKS, Vec3 } from "../lib/body/landmarks";
import { useNeuro } from "./store";

// ============================================================================
//  CUERPO HUMANO REAL (malla riggeada)
// ----------------------------------------------------------------------------
//  Ya no son cilindros: es una malla humana de verdad (CesiumMan, Khronos,
//  CC-BY) con su esqueleto. La piel se re-materializa en un tono carnal
//  translucido para que encaje con la estetica y deje ver el cerebro. Sus
//  huesos (caderas, rodillas, hombros) los MUEVEN los mismos angulos que
//  produce la marcha neuromecanica emergente: no hay animacion enlatada, el
//  cuerpo camina porque sus articulaciones siguen a sus impulsos.
//
//  El modelo esta autoria Z-arriba (z=alto, x=frente/atras, y=izq/der) y cada
//  articulacion flexiona sobre su eje Y local. Pero YA viene de pie: sus nodos
//  "Z_UP"/"Armature" traen matrices que GLTFLoader aplica al cargar y lo dejan
//  erguido en Y mundo. Nosotros solo lo escalamos a ~30 unidades y le clavamos
//  los pies al piso (sin rotarlo: rotarlo de nuevo lo tumbaba de costado).
// ============================================================================

const MODEL = "/models/CesiumMan.glb";
useGLTF.preload(MODEL);

const TARGET_H = 30; // altura deseada del cuerpo en unidades de escena
const GROUND_Y = -15; // los pies apoyan aqui (coincide con el terreno)

// Eje de flexion sagital: Y local del hueso (ver cabecera).
const FLEX = new THREE.Vector3(0, 1, 0);
const tmpQuat = new THREE.Quaternion();

export default function HumanMesh() {
  const showBody = useNeuro((s) => s.showBody);
  const engine = useNeuro((s) => s.engine);
  const stimulate = useNeuro((s) => s.stimulate);
  const { scene } = useGLTF(MODEL);

  // Prepara la malla una sola vez: material holografico carnal, orientacion,
  // encaje de tamaño/posicion y referencias a los huesos que mueve la marcha.
  const rig = useMemo(() => {
    const skin = new THREE.MeshStandardMaterial({
      color: "#e6a382",
      roughness: 0.5,
      metalness: 0.05,
      emissive: new THREE.Color("#7d4f93"),
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
    });
    let mesh: THREE.SkinnedMesh | undefined;
    scene.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) {
        sm.material = skin;
        sm.frustumCulled = false;
        if (!mesh) mesh = sm;
      }
    });

    scene.updateMatrixWorld(true);
    // Medimos la malla en su espacio de autoria (Z-up) con el bounding box de su
    // GEOMETRIA en pose de reposo. NO usamos setFromObject sobre la SkinnedMesh:
    // devuelve cajas gigantes y erroneas (la deformacion por huesos no se refleja
    // en la matriz de mundo). Como bindMatrix y los nodos padre son identidad, el
    // box local de la geometria es directamente el espacio de autoria.
    mesh?.geometry.computeBoundingBox();
    const box =
      mesh?.geometry.boundingBox ??
      new THREE.Box3(
        new THREE.Vector3(-0.13, -0.57, 0),
        new THREE.Vector3(0.18, 0.57, 1.51)
      );
    // OJO: la geometria se mide en su espacio de autoria (Z-up: z=alto), pero el
    // modelo YA viene de pie. Sus nodos "Z_UP" y "Armature" traen matrices que
    // GLTFLoader aplica al cargar (giran Z-up->Y-up), asi que la malla renderiza
    // erguida en Y sin que toquemos nada. Por eso NO rotamos el grupo: solo lo
    // escalamos y le clavamos los pies al piso. (Antes le metiamos un segundo giro
    // y lo tumbabamos de costado.) El mapeo interno sigue siendo autoria x->Z
    // mundo, y->X mundo, z->Y mundo, que es justo lo que hacen esas matrices.
    const hAuthor = box.max.z - box.min.z || 1.5;
    const s = TARGET_H / hAuthor;
    const posY = GROUND_Y - box.min.z * s; // pies (min z) al piso
    const cx = (box.min.x + box.max.x) / 2; // autoria x -> Z mundo
    const cy = (box.min.y + box.max.y) / 2; // autoria y -> X mundo
    const offX = -cy * s;
    const offZ = -cx * s;

    const get = (n: string) => scene.getObjectByName(n) as THREE.Object3D | undefined;
    const bones = {
      hipL: get("leg_joint_L_1"),
      kneeL: get("leg_joint_L_2"),
      hipR: get("leg_joint_R_1"),
      kneeR: get("leg_joint_R_2"),
      shoulderL: get("Skeleton_arm_joint_L__4_"),
      shoulderR: get("Skeleton_arm_joint_R"),
    };
    const rest: Record<string, THREE.Quaternion> = {};
    (Object.keys(bones) as (keyof typeof bones)[]).forEach((k) => {
      const b = bones[k];
      if (b) rest[k] = b.quaternion.clone();
    });

    return { s, posY, offX, offZ, bones, rest };
  }, [scene]);

  const group = useRef<THREE.Group>(null);

  // La marcha mueve los huesos. Cada hueso = rotacion de reposo * flexion(angulo)
  // sobre su eje Y local. Signos elegidos para que el paso vaya hacia adelante.
  useFrame(() => {
    const g = engine?.gaitSnapshot();
    if (!g) return;
    const { bones, rest } = rig;
    const flex = (k: keyof typeof bones, angle: number) => {
      const b = bones[k];
      const r = rest[k];
      if (!b || !r) return;
      b.quaternion.copy(r).multiply(tmpQuat.setFromAxisAngle(FLEX, angle));
    };
    flex("hipL", g.hipL);
    flex("hipR", g.hipR);
    flex("kneeL", -g.kneeL);
    flex("kneeR", -g.kneeR);
    flex("shoulderL", g.shoulderL * 0.5);
    flex("shoulderR", g.shoulderR * 0.5);
  });

  // Zonas sensibles clicables (aprox. en los landmarks del cuerpo) para inyectar
  // estimulo. No siguen la flexion fina del miembro, pero conservan la interaccion.
  const touch = (pos: Vec3, region: string, r: number) => (
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
        color="#3cffd2"
        transparent
        opacity={0.22}
        emissive="#3cffd2"
        emissiveIntensity={0.5}
        depthWrite={false}
      />
    </mesh>
  );

  if (!showBody) return null;
  const L = LANDMARKS;

  return (
    <group>
      <group
        ref={group}
        position={[rig.offX, rig.posY, rig.offZ]}
        scale={rig.s}
      >
        <primitive object={scene} />
      </group>

      {/* Interaccion sensorial (ojos, manos, pies) en posiciones aproximadas */}
      {touch(L.eyeL, "retina_L", 0.34)}
      {touch(L.eyeR, "retina_R", 0.34)}
      {touch(L.handL, "skin_hand_L", 0.7)}
      {touch(L.handR, "skin_hand_R", 0.7)}
      {touch(L.footL, "skin_foot_L", 0.7)}
      {touch(L.footR, "skin_foot_R", 0.7)}
    </group>
  );
}
