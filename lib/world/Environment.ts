// El mundo exterior: un terreno circular sembrado de recursos (comida y agua)
// y un ciclo dia/noche. Es la fuente de todo lo que el organismo necesita para
// sobrevivir; cierra el bucle sensoriomotor-metabolico junto con el Agente.

export type ResourceKind = "food" | "water";

export interface Resource {
  id: number;
  kind: ResourceKind;
  x: number;
  z: number;
  amount: number; // 0..1 (0 = consumido, esperando reaparecer)
  respawnAt: number; // ms de mundo en que vuelve a estar disponible
}

// Un arbol del bosque. Es escenografia fija (no se mueve) pero forma parte del
// modelo del mundo para ser reproducible por semilla y servir de referencia
// espacial: da un "aqui" con textura, no un vacio abstracto.
export interface Tree {
  x: number;
  z: number;
  scale: number; // tamaño relativo (~0.7 a 1.5)
  rot: number; // giro en Y
  tint: number; // 0..1, variacion de color/forma del follaje
}

export interface WorldState {
  resources: Resource[];
  dayPhase: number; // 0..1 (0 amanecer, 0.5 atardecer, ~0.75 medianoche)
  light: number; // 0..1 luz ambiente
  time: number; // ms de mundo transcurridos
}

export const ARENA_R = 60; // radio del terreno jugable
export const GROUND_Y = -15; // altura del suelo (los pies quedan a ~-14.6/-15)
const DAY_MS = 120000; // duracion de un ciclo dia/noche completo (2 min sim)

// Generador congruencial lineal simple y determinista (no depende del RNG del
// cerebro, para que el mundo sea reproducible por su propia semilla).
class LCG {
  private s: number;
  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) >>> 0;
    return this.s / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
}

export class Environment {
  resources: Resource[] = [];
  trees: Tree[] = [];
  time = 0;
  private rng: LCG;
  private nextId = 0;

  constructor(seed = 20260706) {
    this.rng = new LCG(seed ^ 0x9e3779b1);
    // Siembra inicial: mas comida que agua, dispersas por el anillo exterior.
    for (let i = 0; i < 7; i++) this.spawn("food");
    for (let i = 0; i < 5; i++) this.spawn("water");
    this.seedForest();
  }

  // Siembra el bosque como una ESPESURA que rodea el prado, en el anillo
  // exterior r in [48, 58]. La clave es que ese radio queda POR FUERA de la
  // orbita tipica de la camara (~45u): asi, cuando la camara mira hacia el
  // organismo en el centro, cada tronco cae al fondo o al costado y NUNCA se
  // interpone entre la camara y el cuerpo (el forrajeo vive en r<28, un prado
  // despejado). Los arboles se difuminan en la niebla (que arranca a 55u), como
  // un bosque que cierra el horizonte. La distribucion sqrt reparte densidad
  // uniforme por area.
  private seedForest(): void {
    const N = 64;
    for (let i = 0; i < N; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const r = Math.sqrt(this.rng.range(48 * 48, (ARENA_R - 2) * (ARENA_R - 2)));
      this.trees.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        scale: this.rng.range(0.72, 1.5),
        rot: this.rng.next() * Math.PI * 2,
        tint: this.rng.next(),
      });
    }
  }

  private randPos(): [number, number] {
    // Anillo cercano al centro: r=8 deja libre donde nace el agente y r=28 lo
    // mantiene a mano. Asi tropieza con recursos a menudo y su aprendizaje se
    // ve avanzar en vivo, en vez de vagar minutos por un anillo lejano.
    const a = this.rng.next() * Math.PI * 2;
    const r = Math.sqrt(this.rng.range(8 * 8, 28 * 28));
    return [Math.cos(a) * r, Math.sin(a) * r];
  }

  private spawn(kind: ResourceKind): Resource {
    const [x, z] = this.randPos();
    const res: Resource = {
      id: this.nextId++,
      kind,
      x,
      z,
      amount: 1,
      respawnAt: 0,
    };
    this.resources.push(res);
    return res;
  }

  // Fase del dia en 0..1 y luz ambiente derivada (curva suave tipo seno).
  get dayPhase(): number {
    return (this.time % DAY_MS) / DAY_MS;
  }

  get light(): number {
    // Amanece en phase=0, mediodia en 0.25, anochece en 0.5, noche en 0.75.
    const s = Math.sin(this.dayPhase * Math.PI * 2 - Math.PI / 2);
    return 0.15 + 0.85 * Math.max(0, (s + 1) / 2);
  }

  update(dtMs: number): void {
    this.time += dtMs;
    for (const r of this.resources) {
      if (r.amount <= 0 && this.time >= r.respawnAt) {
        // Reaparece en un lugar nuevo (el recurso "migra").
        const [x, z] = this.randPos();
        r.x = x;
        r.z = z;
        r.amount = 1;
      }
    }
  }

  // Recurso disponible mas cercano a (x,z), opcionalmente filtrado por tipo.
  nearest(x: number, z: number, kind?: ResourceKind): Resource | null {
    let best: Resource | null = null;
    let bestD = Infinity;
    for (const r of this.resources) {
      if (r.amount <= 0) continue;
      if (kind && r.kind !== kind) continue;
      const d = (r.x - x) * (r.x - x) + (r.z - z) * (r.z - z);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  }

  // Consume el primer recurso disponible dentro de `radius` de (x,z).
  // Devuelve su tipo (para que el organismo coma/beba) o null.
  consumeAt(x: number, z: number, radius: number): ResourceKind | null {
    const r2 = radius * radius;
    for (const r of this.resources) {
      if (r.amount <= 0) continue;
      const d = (r.x - x) * (r.x - x) + (r.z - z) * (r.z - z);
      if (d <= r2) {
        r.amount = 0;
        // Reaparece entre 7 y 14 s de mundo mas tarde (forrajeo frecuente).
        r.respawnAt = this.time + this.rng.range(7000, 14000);
        return r.kind;
      }
    }
    return null;
  }

  snapshot(): WorldState {
    return {
      resources: this.resources,
      dayPhase: this.dayPhase,
      light: this.light,
      time: this.time,
    };
  }
}
