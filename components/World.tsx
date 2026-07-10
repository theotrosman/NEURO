"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNeuro } from "./store";
import { ARENA_R, GROUND_Y, Tree } from "../lib/world/Environment";

// ----------------------------------------------------------------------------
//  BOSQUE
//  Arboles instanciados (un solo draw call para troncos y otro para copas) para
//  no castigar los 60fps que ya cuestan las ~6000 neuronas. Son escenografia
//  fija: se calculan sus matrices una vez. Su altura esta pensada en relacion al
//  cuerpo humano (30u): un arbol adulto ronda 45-70u, mas alto que el organismo,
//  para que el mundo se sienta un bosque y no un cesped con palitos.
// ----------------------------------------------------------------------------
function Forest({ trees }: { trees: Tree[] }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);

  const trunkGeo = useMemo(() => {
    // Fuste esbelto pero alto. Como el bosque vive lejos (r>=48u), no tapa al
    // organismo; su altura da verticalidad al horizonte.
    const g = new THREE.CylinderGeometry(0.5, 1.0, 46, 6);
    g.translate(0, 23, 0); // base apoyada en el suelo del grupo
    return g;
  }, []);
  const canopyGeo = useMemo(() => {
    // Copa amplia y alta, para que la espesura lejana lea como una masa de
    // follaje que cierra el horizonte por encima de la cabeza (~15u).
    const g = new THREE.IcosahedronGeometry(12, 1);
    g.translate(0, 52, 0); // copa sobre el tronco
    return g;
  }, []);

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    trees.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      pos.set(t.x, GROUND_Y, t.z);
      // Variacion de altura para que no sean clones: mas alto con tint alto,
      // pero suave (evita arboles achaparrados o desmesurados).
      scl.set(t.scale, t.scale * (0.92 + t.tint * 0.22), t.scale);
      m.compose(pos, q, scl);
      trunk.setMatrixAt(i, m);
      canopy.setMatrixAt(i, m);
      // Follaje entre verde profundo y verde-azulado fosforescente (hacia el
      // cyan del agua), como una espesura bioluminiscente que cierra el mundo.
      col.setHSL(0.3 + t.tint * 0.18, 0.6, 0.35 + t.tint * 0.1);
      canopy.setColorAt(i, col);
    });
    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
  }, [trees]);

  if (!trees.length) return null;
  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, undefined, trees.length]}
        frustumCulled={false}
        castShadow={false}
      >
        <meshStandardMaterial
          color="#4a3729"
          roughness={0.9}
          metalness={0.04}
          emissive="#241a10"
          emissiveIntensity={0.5}
        />
      </instancedMesh>
      <instancedMesh
        ref={canopyRef}
        args={[canopyGeo, undefined, trees.length]}
        frustumCulled={false}
        castShadow={false}
      >
        <meshStandardMaterial
          roughness={0.65}
          metalness={0.05}
          emissive="#0e3a20"
          emissiveIntensity={0.55}
          flatShading
          transparent
          opacity={0.94}
        />
      </instancedMesh>
    </group>
  );
}

const FOOD_COLOR = "#3cff8a";
const WATER_COLOR = "#4ad0ff";
const DAY_SKY = new THREE.Color("#0a1030");
const NIGHT_SKY = new THREE.Color("#03040a");

// El terreno, los recursos y la iluminacion ambiental (ciclo dia/noche).
// Vive FUERA del rig del agente: es el marco de referencia del mundo.
export default function World() {
  const engine = useNeuro((s) => s.engine);
  const showWorld = useNeuro((s) => s.showWorld);

  const orbRefs = useRef<(THREE.Group | null)[]>([]);
  const memRefs = useRef<(THREE.Mesh | null)[]>([]);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);

  const resources = engine?.world.resources ?? [];

  useFrame((state) => {
    if (!engine) return;
    const res = engine.world.resources;
    const t = performance.now() * 0.002;

    // Recursos: flotan y giran; se ocultan mientras estan consumidos.
    for (let i = 0; i < res.length; i++) {
      const g = orbRefs.current[i];
      if (!g) continue;
      const r = res[i];
      if (r.amount <= 0) {
        g.visible = false;
      } else {
        g.visible = true;
        g.position.set(r.x, GROUND_Y + 1.4 + Math.sin(t + i) * 0.35, r.z);
        g.rotation.y = t + i;
      }
    }

    // Memoria espacial (hipocampo): anillos en el suelo donde el organismo
    // recuerda haber encontrado comida o agua. Brillan segun la fuerza del
    // recuerdo y laten suavemente; es conocimiento del mundo hecho visible.
    const sites = engine.memory.sites;
    for (let i = 0; i < memRefs.current.length; i++) {
      const ring = memRefs.current[i];
      if (!ring) continue;
      const site = sites[i];
      if (!site) {
        ring.visible = false;
        continue;
      }
      ring.visible = true;
      ring.position.set(site.x, GROUND_Y + 0.06, site.z);
      const sc = (1.1 + site.strength * 1.7) * (1 + Math.sin(t * 1.5 + i) * 0.05);
      ring.scale.set(sc, sc, sc);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.color.set(site.kind === "food" ? FOOD_COLOR : WATER_COLOR);
      mat.opacity = 0.12 + site.strength * 0.3;
    }

    // Ciclo dia/noche: intensidad de luz y color de cielo/niebla.
    const light = engine.world.light;
    if (hemiRef.current) hemiRef.current.intensity = 0.25 + light * 0.85;
    if (sunRef.current) sunRef.current.intensity = 0.15 + light * 0.95;
    const sky = NIGHT_SKY.clone().lerp(DAY_SKY, light);
    state.scene.background = sky;
    if (state.scene.fog) (state.scene.fog as THREE.Fog).color.copy(sky);
  });

  if (!engine || !showWorld) return null;

  return (
    <group>
      {/* Luces del mundo (moduladas por el ciclo dia/noche) */}
      <hemisphereLight ref={hemiRef} args={["#9fbcff", "#0a0f1e", 0.8]} />
      <directionalLight ref={sunRef} position={[30, 60, 20]} intensity={0.8} />

      {/* Suelo circular */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]}>
        <circleGeometry args={[ARENA_R, 72]} />
        <meshStandardMaterial
          color="#0b1430"
          roughness={0.95}
          metalness={0.05}
          emissive="#0a1024"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Rejilla para dar sensacion de escala y movimiento */}
      <gridHelper
        args={[ARENA_R * 2, 48, "#22366a", "#141f3a"]}
        position={[0, GROUND_Y + 0.03, 0]}
      />

      {/* Anillo de borde de la arena */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y + 0.04, 0]}>
        <ringGeometry args={[ARENA_R - 1, ARENA_R, 96]} />
        <meshBasicMaterial color="#2b4790" transparent opacity={0.5} />
      </mesh>

      {/* Bosque: arboles instanciados que enmarcan la escena */}
      <Forest trees={engine.world.trees} />

      {/* Recursos: comida (verde) y agua (azul), con baliza de luz */}
      {resources.map((r, i) => {
        const c = r.kind === "food" ? FOOD_COLOR : WATER_COLOR;
        return (
          <group
            key={r.id}
            ref={(el) => {
              orbRefs.current[i] = el;
            }}
          >
            <mesh>
              {r.kind === "food" ? (
                <icosahedronGeometry args={[1.1, 0]} />
              ) : (
                <sphereGeometry args={[1.1, 20, 20]} />
              )}
              <meshStandardMaterial
                color={c}
                emissive={c}
                emissiveIntensity={0.9}
                roughness={0.3}
                metalness={0.2}
                toneMapped={false}
              />
            </mesh>
            {/* Halo */}
            <mesh>
              <sphereGeometry args={[1.9, 16, 16]} />
              <meshBasicMaterial
                color={c}
                transparent
                opacity={0.14}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            {/* Baliza vertical: visible desde lejos */}
            <mesh position={[0, GROUND_Y * 0.5 - 1.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, Math.abs(GROUND_Y) + 3, 6]} />
              <meshBasicMaterial
                color={c}
                transparent
                opacity={0.28}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* Marcas de memoria espacial: anillos donde el organismo recuerda que
          hubo un recurso (verde=comida, azul=agua). Se avivan con el recuerdo. */}
      {Array.from({ length: 18 }).map((_, i) => (
        <mesh
          key={`mem-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          ref={(el) => {
            memRefs.current[i] = el;
          }}
        >
          <ringGeometry args={[1.5, 2.05, 30]} />
          <meshBasicMaterial
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
