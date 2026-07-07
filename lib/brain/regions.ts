import { NeuronTypeName } from "../neuron/NeuronTypes";
import { LANDMARKS, Vec3 } from "../body/landmarks";

// Transformacion del espacio "cerebro-local" (numeros comodos) al espacio
// de escena: se escala y se traslada al interior de la cabeza.
export const BRAIN_SCALE = 0.44;
export const BRAIN_ORIGIN: Vec3 = LANDMARKS.headCenter;

export function brainToScene(local: Vec3): Vec3 {
  return [
    BRAIN_ORIGIN[0] + local[0] * BRAIN_SCALE,
    BRAIN_ORIGIN[1] + local[1] * BRAIN_SCALE,
    BRAIN_ORIGIN[2] + local[2] * BRAIN_SCALE,
  ];
}

export interface BrainRegion {
  name: string;
  label: string;
  color: string;
  space: "brain" | "scene";
  center: Vec3; // cerebro-local (space="brain") o escena (space="scene")
  extent: Vec3; // radios del elipsoide donde se dispersan los somas
  shell: boolean; // sesgar hacia la superficie (aspecto de corteza)
  count: number; // numero base de neuronas
  types: [NeuronTypeName, number][]; // distribucion (prob. deben sumar ~1)
}

// Distribucion cortical estandar: ~80% excitatorias, ~20% interneuronas.
const CORTEX: [NeuronTypeName, number][] = [
  ["pyramidal_RS", 0.58],
  ["pyramidal_IB", 0.13],
  ["chattering_CH", 0.05],
  ["basket_FS", 0.14],
  ["martinotti_LTS", 0.1],
];

export const REGIONS: BrainRegion[] = [
  // ---- Corteza (capa externa, transformada al interior de la cabeza) ----
  {
    name: "prefrontal", label: "Corteza prefrontal", color: "#ff6b4a",
    space: "brain", center: [0, 1.6, 4.2], extent: [3.4, 1.6, 1.2], shell: true,
    count: 520, types: CORTEX,
  },
  {
    name: "frontal", label: "Lobulo frontal", color: "#ff7a3c",
    space: "brain", center: [0, 2.7, 2.4], extent: [3.6, 1.6, 1.4], shell: true,
    count: 460, types: CORTEX,
  },
  {
    name: "motor_cortex", label: "Corteza motora", color: "#ffe14a",
    space: "brain", center: [0, 3.3, 0.4], extent: [3.7, 1.0, 0.8], shell: true,
    count: 420,
    types: [
      ["pyramidal_RS", 0.42], ["pyramidal_IB", 0.15], ["motor_neuron", 0.16],
      ["basket_FS", 0.15], ["martinotti_LTS", 0.12],
    ],
  },
  {
    name: "somatosensory", label: "Corteza somatosensorial", color: "#3cffd2",
    space: "brain", center: [0, 3.3, -0.7], extent: [3.7, 1.0, 0.8], shell: true,
    count: 420, types: CORTEX,
  },
  {
    name: "parietal", label: "Lobulo parietal", color: "#4ad0ff",
    space: "brain", center: [0, 2.6, -2.6], extent: [3.5, 1.6, 1.3], shell: true,
    count: 430, types: CORTEX,
  },
  {
    name: "occipital", label: "Corteza visual (occipital)", color: "#7c9bff",
    space: "brain", center: [0, 0.6, -4.6], extent: [3.0, 1.8, 1.0], shell: true,
    count: 460, types: CORTEX,
  },
  {
    name: "temporal_L", label: "Lobulo temporal izq.", color: "#c06bff",
    space: "brain", center: [-3.6, -0.9, 0.6], extent: [1.1, 1.6, 2.6], shell: true,
    count: 300, types: CORTEX,
  },
  {
    name: "temporal_R", label: "Lobulo temporal der.", color: "#c06bff",
    space: "brain", center: [3.6, -0.9, 0.6], extent: [1.1, 1.6, 2.6], shell: true,
    count: 300, types: CORTEX,
  },

  // ---- Subcortical (nucleo interno) ----
  {
    name: "thalamus", label: "Talamo (relevo sensorial)", color: "#7cff5f",
    space: "brain", center: [0, 0.1, -0.2], extent: [1.4, 1.0, 1.2], shell: false,
    count: 320, types: [["thalamocortical_TC", 0.75], ["basket_FS", 0.25]],
  },
  {
    name: "hippocampus", label: "Hipocampo (memoria)", color: "#ff9ad0",
    space: "brain", center: [0, -1.3, -1.4], extent: [2.6, 0.7, 1.4], shell: false,
    count: 260,
    types: [["pyramidal_RS", 0.6], ["pyramidal_IB", 0.1], ["basket_FS", 0.2], ["martinotti_LTS", 0.1]],
  },
  {
    name: "amygdala", label: "Amigdala (emocion)", color: "#ff5a8a",
    space: "brain", center: [0, -1.4, 1.3], extent: [2.2, 0.7, 0.8], shell: false,
    count: 160,
    types: [["pyramidal_RS", 0.6], ["basket_FS", 0.25], ["martinotti_LTS", 0.15]],
  },
  {
    name: "basal_ganglia", label: "Ganglios basales (accion)", color: "#5fd0c0",
    space: "brain", center: [0, 0.4, 1.0], extent: [2.2, 1.0, 1.0], shell: false,
    count: 260,
    types: [["martinotti_LTS", 0.5], ["basket_FS", 0.35], ["chattering_CH", 0.15]],
  },
  {
    name: "substantia_nigra", label: "Sustancia negra (dopamina)", color: "#ffd23c",
    space: "brain", center: [0, -1.9, -0.5], extent: [1.4, 0.5, 0.6], shell: false,
    count: 120, types: [["dopaminergic", 0.8], ["basket_FS", 0.2]],
  },
  {
    name: "hypothalamus", label: "Hipotalamo (homeostasis)", color: "#ffb03c",
    space: "brain", center: [0, -1.0, 0.5], extent: [1.0, 0.5, 0.7], shell: false,
    count: 150,
    types: [["pyramidal_RS", 0.65], ["basket_FS", 0.2], ["martinotti_LTS", 0.15]],
  },
  {
    name: "cerebellum", label: "Cerebelo (coordinacion)", color: "#b06cff",
    space: "brain", center: [0, -2.4, -3.9], extent: [3.0, 1.3, 1.3], shell: true,
    count: 620,
    types: [["pyramidal_RS", 0.6], ["purkinje", 0.25], ["basket_FS", 0.15]],
  },
  {
    name: "brainstem", label: "Tronco encefalico", color: "#ff8f5f",
    space: "brain", center: [0, -3.4, -1.2], extent: [0.9, 1.4, 0.9], shell: false,
    count: 220,
    types: [["pyramidal_RS", 0.4], ["motor_neuron", 0.2], ["thalamocortical_TC", 0.1], ["basket_FS", 0.3]],
  },

  // ---- Periferia (coordenadas de escena, fuera del craneo) ----
  {
    name: "spinal_cord", label: "Medula espinal", color: "#ffcf5a",
    space: "scene", center: [0, 5.4, -0.6], extent: [0.5, 5.2, 0.4], shell: false,
    count: 240,
    types: [["motor_neuron", 0.6], ["pyramidal_RS", 0.2], ["basket_FS", 0.2]],
  },
  {
    name: "retina_L", label: "Retina izq.", color: "#3cffd2",
    space: "scene", center: LANDMARKS.eyeL, extent: [0.4, 0.4, 0.2], shell: false,
    count: 60, types: [["sensory_receptor", 1]],
  },
  {
    name: "retina_R", label: "Retina der.", color: "#3cffd2",
    space: "scene", center: LANDMARKS.eyeR, extent: [0.4, 0.4, 0.2], shell: false,
    count: 60, types: [["sensory_receptor", 1]],
  },
  {
    name: "skin_hand_L", label: "Receptores mano izq.", color: "#3cffd2",
    space: "scene", center: LANDMARKS.handL, extent: [0.6, 0.6, 0.6], shell: false,
    count: 70, types: [["sensory_receptor", 1]],
  },
  {
    name: "skin_hand_R", label: "Receptores mano der.", color: "#3cffd2",
    space: "scene", center: LANDMARKS.handR, extent: [0.6, 0.6, 0.6], shell: false,
    count: 70, types: [["sensory_receptor", 1]],
  },
  {
    name: "skin_foot_L", label: "Receptores pie izq.", color: "#3cffd2",
    space: "scene", center: LANDMARKS.footL, extent: [0.6, 0.5, 0.6], shell: false,
    count: 45, types: [["sensory_receptor", 1]],
  },
  {
    name: "skin_foot_R", label: "Receptores pie der.", color: "#3cffd2",
    space: "scene", center: LANDMARKS.footR, extent: [0.6, 0.5, 0.6], shell: false,
    count: 45, types: [["sensory_receptor", 1]],
  },
];

export const REGION_INDEX: Record<string, number> = Object.fromEntries(
  REGIONS.map((r, i) => [r.name, i])
);
