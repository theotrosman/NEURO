import { Network } from "./Network";

// Plasticidad sinaptica dependiente del tiempo de disparo (STDP) modulada por
// recompensa: la regla de los TRES FACTORES.
//
//   1) STDP: si la presinaptica dispara justo ANTES que la postsinaptica, la
//      sinapsis se marca para potenciarse (LTP); si dispara despues, para
//      deprimirse (LTD). Esa marca es una "traza de elegibilidad" que decae.
//   2) Recompensa (dopamina): un tercer factor global. Solo cuando llega
//      recompensa se consolidan de verdad las sinapsis elegibles.
//
// Asi la red aprende que patrones de actividad precedieron a algo bueno
// (comer, beber) y refuerza justamente esos caminos: aprendizaje por refuerzo
// biologicamente plausible.

const STDP_WINDOW = 20; // ms: ventana de coincidencia pre/post
const TAU_STDP = 12; // ms: constante del kernel STDP
const A_PLUS = 0.02; // amplitud LTP
const A_MINUS = 0.021; // amplitud LTD (algo mayor: estabilidad)
const TAU_ELIG = 1000; // ms: la elegibilidad dura ~1 s (dopamina tardia)
const LR = 0.05; // tasa de aprendizaje por recompensa
const WMIN = 0.25; // peso minimo relativo al inicial
const WMAX = 3.0; // peso maximo relativo al inicial

export interface PlasticityStats {
  active: number; // sinapsis con elegibilidad viva
  potentiation: number; // cambio total de peso acumulado
  enabled: boolean;
}

export class Plasticity {
  enabled = true;
  totalPotentiation = 0;

  private net: Network;
  private elig: Float32Array;
  private w0: Float32Array;
  private incoming: number[][];
  private active: number[] = [];
  private inActive: Uint8Array;
  private eligDecayPerStep: number;

  constructor(net: Network) {
    this.net = net;
    const n = net.synapses.length;
    this.elig = new Float32Array(n);
    this.w0 = new Float32Array(n);
    this.inActive = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.w0[i] = net.synapses[i].weight;

    // Indice inverso: sinapsis ENTRANTES por neurona (para la parte LTP).
    this.incoming = net.neurons.map(() => [] as number[]);
    for (let i = 0; i < n; i++) this.incoming[net.synapses[i].post].push(i);

    this.eligDecayPerStep = Math.exp(-1 / TAU_ELIG); // DT = 1 ms
  }

  private touch(s: number): void {
    if (!this.inActive[s]) {
      this.inActive[s] = 1;
      this.active.push(s);
    }
  }

  // Se llama tras cada net.step(): acumula elegibilidad segun coincidencias.
  step(): void {
    if (!this.enabled) return;
    const net = this.net;
    const T = net.time;
    const syn = net.synapses;
    const neu = net.neurons;
    const spikes = net.spikesThisStep;

    for (let k = 0; k < spikes.length; k++) {
      const postId = spikes[k];

      // LTP: sinapsis entrantes cuya presinaptica disparo justo antes.
      const inc = this.incoming[postId];
      for (let j = 0; j < inc.length; j++) {
        const s = inc[j];
        const dt = T - neu[syn[s].pre].lastSpikeTime;
        if (dt >= 0 && dt <= STDP_WINDOW) {
          this.elig[s] += A_PLUS * Math.exp(-dt / TAU_STDP);
          this.touch(s);
        }
      }

      // LTD: sinapsis salientes cuya postsinaptica disparo justo antes (anti-causal).
      const out = neu[postId].out;
      for (let j = 0; j < out.length; j++) {
        const s = out[j];
        const dt = neu[syn[s].post].lastSpikeTime - T;
        if (dt < 0 && dt >= -STDP_WINDOW) {
          this.elig[s] -= A_MINUS * Math.exp(dt / TAU_STDP);
          this.touch(s);
        }
      }
    }
  }

  // Tercer factor: consolida las sinapsis elegibles segun la dopamina del
  // fotograma y decae las trazas. `steps` = pasos simulados en el fotograma.
  applyReward(dopamine: number, steps: number): void {
    if (!this.enabled) return;
    const decay = Math.pow(this.eligDecayPerStep, steps);
    const syn = this.net.synapses;
    const lr = LR * dopamine;
    let write = 0;
    let pot = 0;

    for (let i = 0; i < this.active.length; i++) {
      const s = this.active[i];
      let e = this.elig[s];

      if (lr !== 0 && e !== 0) {
        const w0 = this.w0[s];
        const lo = w0 * WMIN;
        const hi = w0 * WMAX;
        let w = syn[s].weight + lr * e;
        w = w < lo ? lo : w > hi ? hi : w;
        pot += Math.abs(w - syn[s].weight);
        syn[s].weight = w;
      }

      e *= decay;
      if (Math.abs(e) < 1e-4) {
        this.elig[s] = 0;
        this.inActive[s] = 0; // sale de la lista activa
      } else {
        this.elig[s] = e;
        this.active[write++] = s;
      }
    }
    this.active.length = write;
    this.totalPotentiation += pot;
  }

  stats(): PlasticityStats {
    return {
      active: this.active.length,
      potentiation: this.totalPotentiation,
      enabled: this.enabled,
    };
  }
}
