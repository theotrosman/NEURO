import * as THREE from "three";

// Convierte un color hex en un THREE.Color cacheado.
const cache = new Map<string, THREE.Color>();
export function color(hex: string): THREE.Color {
  let c = cache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    cache.set(hex, c);
  }
  return c;
}
