"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNeuro } from "./store";
import { ARENA_R, GROUND_Y } from "../lib/world/Environment";

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
