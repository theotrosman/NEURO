import { NeurotransmitterName } from "./Neurotransmitter";

// Tipos de neurona basados en clases celulares reales del cerebro humano.
// Los parametros a,b,c,d corresponden al modelo de Izhikevich (2003),
// que reproduce los patrones de disparo observados en electrofisiologia.
export type NeuronTypeName =
  | "pyramidal_RS" // piramidal cortical, "regular spiking"
  | "pyramidal_IB" // piramidal de disparo en rafagas ("intrinsically bursting")
  | "chattering_CH" // interneurona/piramidal de alta frecuencia
  | "basket_FS" // interneurona en cesta, "fast spiking" (GABA)
  | "martinotti_LTS" // interneurona Martinotti, "low-threshold spiking" (GABA)
  | "thalamocortical_TC" // neurona talamo-cortical (relevo sensorial)
  | "sensory_receptor" // receptor sensorial periferico
  | "motor_neuron" // motoneurona (medula/tronco -> musculo)
  | "dopaminergic" // neurona dopaminergica (sustancia negra / VTA)
  | "purkinje"; // celula de Purkinje (cerebelo, GABA)

export interface NeuronType {
  name: NeuronTypeName;
  label: string;
  // Parametros de Izhikevich.
  a: number; // escala de tiempo de la variable de recuperacion u
  b: number; // sensibilidad de u respecto al voltaje v
  c: number; // voltaje de reset tras el disparo (mV)
  d: number; // salto de u tras el disparo
  excitatory: boolean;
  transmitter: NeurotransmitterName;
  // Radio del soma para el render (unidades de escena).
  somaRadius: number;
  color: string;
}

export const NEURON_TYPES: Record<NeuronTypeName, NeuronType> = {
  pyramidal_RS: {
    name: "pyramidal_RS",
    label: "Piramidal (regular spiking)",
    a: 0.02, b: 0.2, c: -65, d: 8,
    excitatory: true, transmitter: "glutamate",
    somaRadius: 0.9, color: "#ff6b4a",
  },
  pyramidal_IB: {
    name: "pyramidal_IB",
    label: "Piramidal (bursting)",
    a: 0.02, b: 0.2, c: -55, d: 4,
    excitatory: true, transmitter: "glutamate",
    somaRadius: 0.95, color: "#ff8a3c",
  },
  chattering_CH: {
    name: "chattering_CH",
    label: "Chattering (alta frecuencia)",
    a: 0.02, b: 0.2, c: -50, d: 2,
    excitatory: true, transmitter: "glutamate",
    somaRadius: 0.85, color: "#ffb03c",
  },
  basket_FS: {
    name: "basket_FS",
    label: "Interneurona en cesta (fast spiking)",
    a: 0.1, b: 0.2, c: -65, d: 2,
    excitatory: false, transmitter: "GABA",
    somaRadius: 0.7, color: "#3ca0ff",
  },
  martinotti_LTS: {
    name: "martinotti_LTS",
    label: "Interneurona Martinotti (LTS)",
    a: 0.02, b: 0.25, c: -65, d: 2,
    excitatory: false, transmitter: "GABA",
    somaRadius: 0.7, color: "#5fc9ff",
  },
  thalamocortical_TC: {
    name: "thalamocortical_TC",
    label: "Talamo-cortical (relevo)",
    a: 0.02, b: 0.25, c: -65, d: 0.05,
    excitatory: true, transmitter: "glutamate",
    somaRadius: 0.9, color: "#7cff5f",
  },
  sensory_receptor: {
    name: "sensory_receptor",
    label: "Receptor sensorial",
    a: 0.02, b: 0.2, c: -65, d: 6,
    excitatory: true, transmitter: "glutamate",
    somaRadius: 0.8, color: "#3cffd2",
  },
  motor_neuron: {
    name: "motor_neuron",
    label: "Motoneurona",
    a: 0.02, b: 0.2, c: -65, d: 8,
    excitatory: true, transmitter: "acetylcholine",
    somaRadius: 1.0, color: "#ffe14a",
  },
  dopaminergic: {
    name: "dopaminergic",
    label: "Dopaminergica",
    a: 0.02, b: 0.2, c: -65, d: 8,
    excitatory: true, transmitter: "dopamine",
    somaRadius: 0.85, color: "#ffd23c",
  },
  purkinje: {
    name: "purkinje",
    label: "Purkinje (cerebelo)",
    a: 0.02, b: 0.2, c: -65, d: 8,
    excitatory: false, transmitter: "GABA",
    somaRadius: 0.9, color: "#b06cff",
  },
};
