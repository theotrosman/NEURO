// Generador de numeros pseudoaleatorios con semilla (mulberry32).
// Deterministico: la misma semilla produce siempre el mismo cerebro.
export class RNG {
  private state: number;

  constructor(seed = 1337) {
    this.state = seed >>> 0;
  }

  // [0, 1)
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, maxExclusive: number): number {
    return Math.floor(this.range(min, maxExclusive));
  }

  // Muestreo gaussiano (Box-Muller) con media y desviacion dadas.
  gaussian(mean = 0, std = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    return mean + std * mag * Math.cos(2.0 * Math.PI * v);
  }

  // true con probabilidad p
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length)];
  }
}
