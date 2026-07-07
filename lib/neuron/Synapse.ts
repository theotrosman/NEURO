import { NeurotransmitterName, NEUROTRANSMITTERS } from "./Neurotransmitter";

// Una sinapsis conecta el axon de una neurona presinaptica con
// la dendrita de una postsinaptica. Modela:
//  - peso (eficacia sinaptica),
//  - signo (excitatorio/inhibitorio segun el neurotransmisor),
//  - retardo axonal (ms) por la velocidad de conduccion,
//  - plasticidad ligera (facilitacion de corto plazo).
export class Synapse {
  readonly pre: number; // id neurona presinaptica
  readonly post: number; // id neurona postsinaptica
  weight: number; // magnitud (>0)
  readonly sign: 1 | -1; // excitatorio (+1) / inhibitorio (-1)
  readonly delayMs: number; // retardo de conduccion
  readonly transmitter: NeurotransmitterName;

  // Estado visual: 0..1, se enciende cuando viaja un impulso.
  activity = 0;
  // true si es un tracto largo (se dibuja como haz y se anima el impulso).
  isTract = false;

  constructor(
    pre: number,
    post: number,
    weight: number,
    transmitter: NeurotransmitterName,
    delayMs: number
  ) {
    this.pre = pre;
    this.post = post;
    this.weight = weight;
    this.sign = NEUROTRANSMITTERS[transmitter].sign;
    this.transmitter = transmitter;
    this.delayMs = delayMs;
  }

  // Corriente con signo que entrega al post-sinaptico.
  signedWeight(): number {
    return this.sign * this.weight;
  }
}
