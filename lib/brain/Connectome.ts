import { Neuron } from "../neuron/Neuron";
import { Synapse } from "../neuron/Synapse";
import { RNG } from "../utils/rng";
import { dist3, Vec3 } from "../body/landmarks";

// Una proyeccion describe un haz de axones entre dos regiones.
// `fanout` = numero medio de sinapsis que emite cada neurona presinaptica.
// El signo (excitatorio/inhibitorio) NO se fija aqui: lo determina el
// neurotransmisor de la neurona presinaptica (principio de Dale).
export interface Projection {
  from: string;
  to: string;
  fanout: number;
  weightMean: number;
  weightStd: number;
  local?: boolean; // conexiones recurrentes de proximidad dentro de la region
  preExcitatoryOnly?: boolean; // los tractos largos solo salen de neuronas excitatorias
}

const L = (from: string, fanout: number, w: number): Projection => ({
  from, to: from, fanout, weightMean: w, weightStd: w * 0.3, local: true,
});

// Conjunto de vias. Refleja circuitos reales del sistema nervioso humano.
export const PROJECTIONS: Projection[] = [
  // --- Recurrencia local dentro de cada region (incluye inhibicion) ---
  L("prefrontal", 14, 3.0), L("frontal", 14, 3.0),
  L("motor_cortex", 14, 3.0), L("somatosensory", 14, 3.0),
  L("parietal", 14, 3.0), L("occipital", 14, 3.0),
  L("temporal_L", 12, 3.0), L("temporal_R", 12, 3.0),
  L("thalamus", 8, 2.6), L("hippocampus", 12, 3.2),
  L("amygdala", 10, 3.2), L("basal_ganglia", 12, 3.4),
  L("hypothalamus", 8, 3.0),
  L("cerebellum", 10, 2.8), L("brainstem", 8, 2.8),
  L("spinal_cord", 6, 2.6),

  // --- Entrada sensorial: receptores -> relevo -> corteza ---
  { from: "retina_L", to: "thalamus", fanout: 6, weightMean: 4.5, weightStd: 1 },
  { from: "retina_R", to: "thalamus", fanout: 6, weightMean: 4.5, weightStd: 1 },
  { from: "thalamus", to: "occipital", fanout: 8, weightMean: 4.0, weightStd: 1 },
  { from: "skin_hand_L", to: "spinal_cord", fanout: 5, weightMean: 4.5, weightStd: 1 },
  { from: "skin_hand_R", to: "spinal_cord", fanout: 5, weightMean: 4.5, weightStd: 1 },
  { from: "skin_foot_L", to: "spinal_cord", fanout: 5, weightMean: 4.5, weightStd: 1 },
  { from: "skin_foot_R", to: "spinal_cord", fanout: 5, weightMean: 4.5, weightStd: 1 },
  { from: "spinal_cord", to: "thalamus", fanout: 6, weightMean: 3.5, weightStd: 1 },
  { from: "thalamus", to: "somatosensory", fanout: 8, weightMean: 4.0, weightStd: 1 },

  // --- Procesamiento cortical (jerarquia perceptiva) ---
  { from: "occipital", to: "parietal", fanout: 6, weightMean: 3.0, weightStd: 1 },
  { from: "occipital", to: "temporal_L", fanout: 4, weightMean: 3.0, weightStd: 1 },
  { from: "occipital", to: "temporal_R", fanout: 4, weightMean: 3.0, weightStd: 1 },
  { from: "somatosensory", to: "parietal", fanout: 6, weightMean: 3.0, weightStd: 1 },
  { from: "parietal", to: "frontal", fanout: 6, weightMean: 3.0, weightStd: 1 },
  { from: "parietal", to: "prefrontal", fanout: 5, weightMean: 2.8, weightStd: 1 },
  { from: "temporal_L", to: "hippocampus", fanout: 5, weightMean: 3.2, weightStd: 1 },
  { from: "temporal_R", to: "hippocampus", fanout: 5, weightMean: 3.2, weightStd: 1 },
  { from: "temporal_L", to: "amygdala", fanout: 4, weightMean: 3.2, weightStd: 1 },
  { from: "temporal_R", to: "amygdala", fanout: 4, weightMean: 3.2, weightStd: 1 },
  { from: "hippocampus", to: "prefrontal", fanout: 5, weightMean: 3.0, weightStd: 1 },
  { from: "amygdala", to: "prefrontal", fanout: 4, weightMean: 3.0, weightStd: 1 },

  // --- Decision -> accion ---
  { from: "prefrontal", to: "frontal", fanout: 6, weightMean: 3.0, weightStd: 1 },
  { from: "frontal", to: "motor_cortex", fanout: 7, weightMean: 3.4, weightStd: 1 },

  // --- Bucle de los ganglios basales: corteza -> estriado -> talamo -> corteza ---
  { from: "motor_cortex", to: "basal_ganglia", fanout: 6, weightMean: 3.0, weightStd: 1 },
  { from: "prefrontal", to: "basal_ganglia", fanout: 5, weightMean: 2.8, weightStd: 1 },
  { from: "basal_ganglia", to: "thalamus", fanout: 6, weightMean: 3.2, weightStd: 1, preExcitatoryOnly: false },
  { from: "thalamus", to: "motor_cortex", fanout: 6, weightMean: 3.6, weightStd: 1 },

  // --- Coordinacion cerebelosa ---
  { from: "motor_cortex", to: "cerebellum", fanout: 5, weightMean: 3.0, weightStd: 1 },
  { from: "cerebellum", to: "thalamus", fanout: 5, weightMean: 3.0, weightStd: 1, preExcitatoryOnly: false },
  { from: "cerebellum", to: "brainstem", fanout: 4, weightMean: 3.0, weightStd: 1, preExcitatoryOnly: false },

  // --- Tracto corticoespinal: la orden motora baja al cuerpo ---
  { from: "motor_cortex", to: "brainstem", fanout: 6, weightMean: 3.8, weightStd: 1 },
  { from: "motor_cortex", to: "spinal_cord", fanout: 6, weightMean: 4.2, weightStd: 1.2 },
  { from: "brainstem", to: "spinal_cord", fanout: 6, weightMean: 4.0, weightStd: 1 },

  // --- Neuromodulacion dopaminergica ---
  { from: "substantia_nigra", to: "basal_ganglia", fanout: 8, weightMean: 3.0, weightStd: 1 },
  { from: "substantia_nigra", to: "prefrontal", fanout: 5, weightMean: 2.0, weightStd: 0.8 },

  // --- Homeostasis: el hipotalamo traduce las pulsiones internas en conducta ---
  { from: "hypothalamus", to: "amygdala", fanout: 5, weightMean: 3.2, weightStd: 1 },
  { from: "hypothalamus", to: "prefrontal", fanout: 5, weightMean: 2.8, weightStd: 1 },
  { from: "hypothalamus", to: "brainstem", fanout: 5, weightMean: 3.0, weightStd: 1 },
  { from: "hypothalamus", to: "substantia_nigra", fanout: 4, weightMean: 2.6, weightStd: 1 },
];

const CONDUCTION_VELOCITY = 1.6; // unidades de escena por ms
const BASE_DELAY = 0.8; // ms

function delayFor(a: Vec3, b: Vec3): number {
  return Math.min(22, BASE_DELAY + dist3(a, b) / CONDUCTION_VELOCITY);
}

export interface ConnectomeResult {
  synapses: Synapse[];
  // Sinapsis de tractos largos (para dibujarlas como haces en 3D).
  tractSynapses: number[];
}

// Construye todas las sinapsis a partir de las neuronas y las proyecciones.
export function buildConnectome(
  neurons: Neuron[],
  regionNeurons: number[][], // indices de neuronas por region
  gain: number,
  rng: RNG
): ConnectomeResult {
  const synapses: Synapse[] = [];
  const tractSynapses: number[] = [];

  for (const proj of PROJECTIONS) {
    const fromIdx = regionNeurons[regionIndexByName(proj.from)];
    const toIdx = regionNeurons[regionIndexByName(proj.to)];
    if (!fromIdx || !toIdx || fromIdx.length === 0 || toIdx.length === 0) continue;

    const excOnly = proj.preExcitatoryOnly ?? !proj.local;

    for (const preId of fromIdx) {
      const pre = neurons[preId];
      if (excOnly && !pre.type.excitatory) continue;

      const posPre: Vec3 = [pre.x, pre.y, pre.z];
      const targets = proj.local
        ? pickLocalTargets(neurons, toIdx, pre, proj.fanout, rng)
        : pickRandomTargets(toIdx, preId, proj.fanout, rng);

      for (const postId of targets) {
        const post = neurons[postId];
        const w = Math.max(0.3, rng.gaussian(proj.weightMean, proj.weightStd)) * gain;
        const delay = delayFor(posPre, [post.x, post.y, post.z]);
        const syn = new Synapse(preId, postId, w, pre.type.transmitter, delay);
        const sid = synapses.length;
        synapses.push(syn);
        pre.out.push(sid);
        pre.outCount++;
        if (!proj.local && delay > 4) {
          syn.isTract = true;
          tractSynapses.push(sid);
        }
      }
    }
  }

  return { synapses, tractSynapses };
}

function pickRandomTargets(
  pool: number[],
  exclude: number,
  count: number,
  rng: RNG
): number[] {
  const out: number[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    let t = pool[rng.int(0, pool.length)];
    if (t === exclude) t = pool[rng.int(0, pool.length)];
    out.push(t);
  }
  return out;
}

// Para conexiones locales: prioriza vecinos cercanos (conectividad de proximidad).
function pickLocalTargets(
  neurons: Neuron[],
  pool: number[],
  pre: Neuron,
  count: number,
  rng: RNG
): number[] {
  const sampleSize = Math.min(pool.length, count * 3 + 2);
  const candidates: { id: number; d: number }[] = [];
  for (let i = 0; i < sampleSize; i++) {
    const id = pool[rng.int(0, pool.length)];
    if (id === pre.id) continue;
    const n = neurons[id];
    const dx = n.x - pre.x, dy = n.y - pre.y, dz = n.z - pre.z;
    candidates.push({ id, d: dx * dx + dy * dy + dz * dz });
  }
  candidates.sort((a, b) => a.d - b.d);
  return candidates.slice(0, count).map((c) => c.id);
}

// Resuelve nombre de region -> indice. Se rellena desde regions.ts al iniciar.
let REGION_INDEX_MAP: Record<string, number> = {};
export function setRegionIndexMap(map: Record<string, number>): void {
  REGION_INDEX_MAP = map;
}
function regionIndexByName(name: string): number {
  return REGION_INDEX_MAP[name];
}
