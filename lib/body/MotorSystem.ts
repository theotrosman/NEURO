import { Network } from "../brain/Network";
import { REGION_INDEX } from "../brain/regions";

export type MuscleChannel = "armL" | "armR" | "legL" | "legR" | "core";

// Traduce la actividad de las motoneuronas en activacion muscular por miembro.
// Cada motoneurona de la medula/tronco se asigna a un canal segun su posicion:
// la parte alta de la medula controla los brazos, la baja las piernas.
export class MotorSystem {
  private channels: Record<MuscleChannel, number[]> = {
    armL: [], armR: [], legL: [], legR: [], core: [],
  };
  private activation: Record<MuscleChannel, number> = {
    armL: 0, armR: 0, legL: 0, legR: 0, core: 0,
  };
  // Linea base lenta: el musculo se mueve ante los CAMBIOS de actividad
  // (rafagas por estimulacion), no ante el disparo tonico de fondo.
  private baseline: Record<MuscleChannel, number> = {
    armL: 0, armR: 0, legL: 0, legR: 0, core: 0,
  };

  constructor(net: Network) {
    const spinal = REGION_INDEX["spinal_cord"];
    const brainstem = REGION_INDEX["brainstem"];
    for (const n of net.neurons) {
      if (n.typeName !== "motor_neuron") continue;
      if (n.region !== spinal && n.region !== brainstem) continue;
      // Alto (brazos) vs bajo (piernas) por altura y; izq/der por id.
      const upper = n.y > 5.2;
      const left = (n.id & 1) === 0;
      let ch: MuscleChannel;
      if (upper) ch = left ? "armL" : "armR";
      else ch = left ? "legL" : "legR";
      this.channels[ch].push(n.id);
      this.channels.core.push(n.id);
    }
  }

  update(net: Network, dtMs: number): void {
    const keys: MuscleChannel[] = ["armL", "armR", "legL", "legR", "core"];
    for (const ch of keys) {
      const ids = this.channels[ch];
      let sum = 0;
      for (const id of ids) sum += net.neurons[id].fireRate;
      const mean = ids.length ? sum / ids.length : 0;
      // La linea base sigue lentamente al disparo tonico de reposo.
      this.baseline[ch] += (mean - this.baseline[ch]) * Math.min(1, dtMs * 0.0009);
      // Solo el exceso claro sobre la base (con margen) contrae el musculo,
      // de modo que en reposo los miembros cuelgan relajados.
      const excess = Math.max(0, mean - this.baseline[ch] * 1.2 - 0.03);
      const target = Math.tanh(excess * 11);
      // Suavizado temporal (el musculo no responde instantaneo).
      const k = Math.min(1, dtMs * 0.02);
      this.activation[ch] += (target - this.activation[ch]) * k;
    }
  }

  get(ch: MuscleChannel): number {
    return this.activation[ch];
  }

  snapshot(): Record<MuscleChannel, number> {
    return { ...this.activation };
  }
}
