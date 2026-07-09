import { ResourceKind } from "../world/Environment";

// Memoria espacial de tipo hipocampal: el organismo recuerda LUGARES donde
// consiguio recursos. Cuando necesita algo pero no lo ve, ya no vaga al azar:
// navega hacia un sitio recordado. Es conocimiento adquirido del mundo.

export interface MemorySite {
  kind: ResourceKind;
  x: number;
  z: number;
  strength: number; // 0..1, se refuerza al revisitar, decae con el olvido
}

const MERGE_DIST = 8; // sitios mas cercanos que esto se consideran el mismo
const MAX_SITES = 18;

export class SpatialMemory {
  sites: MemorySite[] = [];

  // Graba un lugar donde encontro un recurso (o refuerza uno cercano).
  remember(kind: ResourceKind, x: number, z: number): void {
    for (const s of this.sites) {
      if (s.kind === kind && Math.hypot(s.x - x, s.z - z) < MERGE_DIST) {
        s.x = (s.x + x) * 0.5;
        s.z = (s.z + z) * 0.5;
        s.strength = Math.min(1, s.strength + 0.3);
        return;
      }
    }
    this.sites.push({ kind, x, z, strength: 0.55 });
    if (this.sites.length > MAX_SITES) {
      // Descarta el recuerdo mas debil.
      let wi = 0;
      for (let i = 1; i < this.sites.length; i++)
        if (this.sites[i].strength < this.sites[wi].strength) wi = i;
      this.sites.splice(wi, 1);
    }
  }

  // Sitio recordado mas cercano del tipo buscado (o null si no recuerda ninguno).
  recall(kind: ResourceKind, x: number, z: number): MemorySite | null {
    let best: MemorySite | null = null;
    let bd = Infinity;
    for (const s of this.sites) {
      if (s.kind !== kind) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  decay(dtMs: number): void {
    for (const s of this.sites) s.strength -= dtMs * 0.0000003;
    this.sites = this.sites.filter((s) => s.strength > 0.05);
  }

  snapshot(): MemorySite[] {
    return this.sites.map((s) => ({ ...s }));
  }
}
