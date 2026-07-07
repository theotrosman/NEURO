// Neurotransmisores modelados y su efecto post-sinaptico.
// signo: +1 excitatorio (despolariza), -1 inhibitorio (hiperpolariza).
export type NeurotransmitterName =
  | "glutamate"
  | "GABA"
  | "dopamine"
  | "serotonin"
  | "acetylcholine"
  | "norepinephrine";

export interface Neurotransmitter {
  name: NeurotransmitterName;
  sign: 1 | -1;
  // Constante de decaimiento de la conductancia sinaptica (ms).
  tauDecay: number;
  color: string;
}

export const NEUROTRANSMITTERS: Record<NeurotransmitterName, Neurotransmitter> = {
  glutamate: { name: "glutamate", sign: 1, tauDecay: 5, color: "#ff5a3c" },
  GABA: { name: "GABA", sign: -1, tauDecay: 10, color: "#3ca0ff" },
  dopamine: { name: "dopamine", sign: 1, tauDecay: 60, color: "#ffd23c" },
  serotonin: { name: "serotonin", sign: -1, tauDecay: 80, color: "#b06cff" },
  acetylcholine: { name: "acetylcholine", sign: 1, tauDecay: 20, color: "#3cffb0" },
  norepinephrine: { name: "norepinephrine", sign: 1, tauDecay: 50, color: "#ff9f3c" },
};
