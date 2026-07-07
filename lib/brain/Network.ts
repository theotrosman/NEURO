import { Neuron } from "../neuron/Neuron";
import { Synapse } from "../neuron/Synapse";
import { NeuronTypeName } from "../neuron/NeuronTypes";
import { RNG } from "../utils/rng";
import { Vec3 } from "../body/landmarks";
import {
  REGIONS,
  REGION_INDEX,
  BrainRegion,
  brainToScene,
} from "./regions";
import {
  buildConnectome,
  setRegionIndexMap,
  ConnectomeResult,
} from "./Connectome";
import { DT } from "../sim/constants";

export interface NetworkOptions {
  seed?: number;
  density?: number;
  gain?: number;
  noiseStd?: number;
}

// Corriente tonica de fondo por region (marcapasos intrinsecos).
const TONIC: Record<string, number> = {
  thalamus: 3.2,
  brainstem: 3.0,
  substantia_nigra: 4.2,
  retina_L: 1.2, retina_R: 1.2,
  skin_hand_L: 0.6, skin_hand_R: 0.6,
  skin_foot_L: 0.6, skin_foot_R: 0.6,
};

// La red completa: neuronas + sinapsis + dinamica temporal con retardos.
export class Network {
  neurons: Neuron[] = [];
  synapses: Synapse[] = [];
  regionNeurons: number[][] = []; // indices de neuronas por region
  tractSynapses: number[] = [];

  time = 0; // ms transcurridos
  stepCount = 0;
  gain: number;
  noiseStd: number;

  private rng: RNG;
  private density: number;

  // Buffer circular para entregar sinapsis con retardo.
  private buckets: number[][] = [];
  private bucketLen = 1;

  // Ruido tonico precomputado por neurona.
  private tonic: Float32Array = new Float32Array(0);

  // Neuronas que dispararon en el paso actual (para render y salida motora).
  spikesThisStep: number[] = [];

  constructor(opts: NetworkOptions = {}) {
    this.rng = new RNG(opts.seed ?? 20260706);
    this.density = opts.density ?? 1.0;
    this.gain = opts.gain ?? 1.0;
    this.noiseStd = opts.noiseStd ?? 2.6;
    this.build();
  }

  private build(): void {
    setRegionIndexMap(REGION_INDEX);
    this.regionNeurons = REGIONS.map(() => []);

    // 1) Crear y dispersar los somas de cada region.
    for (let r = 0; r < REGIONS.length; r++) {
      const region = REGIONS[r];
      const count = Math.max(1, Math.round(region.count * this.density));
      for (let i = 0; i < count; i++) {
        const pos = this.scatter(region);
        const typeName = this.sampleType(region);
        const id = this.neurons.length;
        const n = new Neuron(id, typeName, r, pos[0], pos[1], pos[2]);
        this.neurons.push(n);
        this.regionNeurons[r].push(id);
      }
    }

    // 2) Ruido tonico por neurona segun su region.
    this.tonic = new Float32Array(this.neurons.length);
    for (const n of this.neurons) {
      this.tonic[n.id] = TONIC[REGIONS[n.region].name] ?? 0;
    }

    // 3) Construir el conectoma (sinapsis con signo, peso y retardo).
    const result: ConnectomeResult = buildConnectome(
      this.neurons,
      this.regionNeurons,
      this.gain,
      this.rng
    );
    this.synapses = result.synapses;
    this.tractSynapses = result.tractSynapses;

    // 4) Dimensionar el buffer de retardos.
    let maxDelay = 1;
    for (const s of this.synapses) maxDelay = Math.max(maxDelay, s.delayMs);
    this.bucketLen = Math.ceil(maxDelay / DT) + 2;
    this.buckets = Array.from({ length: this.bucketLen }, () => []);
  }

  // Punto aleatorio dentro del elipsoide de la region (sesgado a superficie si shell).
  private scatter(region: BrainRegion): Vec3 {
    // Direccion uniforme en la esfera.
    let x = this.rng.gaussian();
    let y = this.rng.gaussian();
    let z = this.rng.gaussian();
    const len = Math.hypot(x, y, z) || 1;
    x /= len; y /= len; z /= len;

    const rr = region.shell
      ? 0.72 + 0.28 * this.rng.next() // cerca de la superficie
      : Math.cbrt(this.rng.next()); // volumen uniforme

    const local: Vec3 = [
      region.center[0] + x * rr * region.extent[0],
      region.center[1] + y * rr * region.extent[1],
      region.center[2] + z * rr * region.extent[2],
    ];
    return region.space === "brain" ? brainToScene(local) : local;
  }

  private sampleType(region: BrainRegion): NeuronTypeName {
    const roll = this.rng.next();
    let acc = 0;
    for (const [type, p] of region.types) {
      acc += p;
      if (roll <= acc) return type;
    }
    return region.types[region.types.length - 1][0];
  }

  private schedule(synId: number, delaySteps: number): void {
    const idx = (this.stepCount + delaySteps) % this.bucketLen;
    this.buckets[idx].push(synId);
  }

  // Avanza un paso de DT ms.
  step(): void {
    this.spikesThisStep.length = 0;

    // a) Entregar las sinapsis programadas para este instante.
    const bucket = this.buckets[this.stepCount % this.bucketLen];
    for (let i = 0; i < bucket.length; i++) {
      const syn = this.synapses[bucket[i]];
      this.neurons[syn.post].receive(syn.signedWeight());
      syn.activity = 1;
    }
    bucket.length = 0;

    // b) Integrar cada neurona y programar sus disparos.
    const neurons = this.neurons;
    for (let i = 0; i < neurons.length; i++) {
      const n = neurons[i];
      const noise = this.rng.gaussian(0, this.noiseStd) + this.tonic[i];
      if (n.step(DT, this.time, noise)) {
        this.spikesThisStep.push(i);
        const out = n.out;
        for (let k = 0; k < out.length; k++) {
          const syn = this.synapses[out[k]];
          const delaySteps = Math.max(1, Math.round(syn.delayMs / DT));
          this.schedule(out[k], delaySteps);
        }
      }
    }

    this.time += DT;
    this.stepCount++;
  }

  // Inyecta corriente en todas las neuronas de una region (estimulo sensorial).
  stimulateRegion(name: string, current: number): void {
    const r = REGION_INDEX[name];
    if (r === undefined) return;
    for (const id of this.regionNeurons[r]) this.neurons[id].stimulate(current);
  }

  stimulateNeuron(id: number, current: number): void {
    if (this.neurons[id]) this.neurons[id].stimulate(current);
  }

  get size(): number {
    return this.neurons.length;
  }

  get synapseCount(): number {
    return this.synapses.length;
  }
}
