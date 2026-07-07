import { Network, NetworkOptions } from "../brain/Network";
import { MotorSystem, MuscleChannel } from "../body/MotorSystem";
import { Physiology, PhysiologyState } from "../body/Physiology";
import { SignalField } from "./SignalField";
import { DT } from "./constants";

// Presupuesto de pulsos visuales generados por fotograma (evita saturar).
const SPAWN_BUDGET = 70;

export interface EngineStats {
  neurons: number;
  synapses: number;
  timeMs: number;
  firingHz: number; // tasa media de disparo por neurona
  activePulses: number;
}

// Une la red neuronal, el sistema motor y el campo de senales.
export class SimulationEngine {
  network: Network;
  motor: MotorSystem;
  signals: SignalField;
  physiology: Physiology;

  private lastFrameSpikes = 0;
  private firingHzEma = 0;
  movementEffort = 0; // 0..1 esfuerzo motor del ultimo fotograma

  constructor(opts: NetworkOptions = {}) {
    this.network = new Network(opts);
    this.motor = new MotorSystem(this.network);
    this.physiology = new Physiology();
    this.signals = new SignalField();
  }

  // Avanza `steps` pasos de simulacion (cada uno DT ms).
  update(steps: number): void {
    const net = this.network;
    let budget = SPAWN_BUDGET;
    let frameSpikes = 0;

    for (let s = 0; s < steps; s++) {
      net.step();
      const spikes = net.spikesThisStep;
      frameSpikes += spikes.length;

      // Genera pulsos visuales en los tractos largos de las neuronas que dispararon.
      if (budget > 0) {
        for (let i = 0; i < spikes.length && budget > 0; i++) {
          const n = net.neurons[spikes[i]];
          const out = n.out;
          for (let k = 0; k < out.length && budget > 0; k++) {
            const syn = net.synapses[out[k]];
            if (syn.isTract) {
              this.signals.spawn(out[k], syn.delayMs);
              budget--;
            }
          }
        }
      }
    }

    const simMs = steps * DT;
    this.motor.update(net, simMs);
    this.signals.update(simMs);

    // Estadistica de tasa de disparo (media movil).
    const hz = simMs > 0 ? (frameSpikes / net.size) / (simMs / 1000) : 0;
    this.firingHzEma += (hz - this.firingHzEma) * 0.1;
    this.lastFrameSpikes = frameSpikes;

    // --- Fisiologia / homeostasis y su acoplamiento al cerebro ---
    const m = this.motor.snapshot();
    const movement = Math.min(
      1,
      (m.legL + m.legR) * 0.5 + (m.armL + m.armR) * 0.25 + m.core * 0.1
    );
    this.movementEffort = movement;
    const neural = Math.min(1, this.firingHzEma / 100);
    const p = this.physiology;
    p.update(simMs, movement, neural);

    // Interocepcion: el hipotalamo "siente" las necesidades internas.
    const drive = p.hunger() * 5 + p.thirst() * 5 + p.tiredness() * 3;
    if (drive > 0.1) net.stimulateRegion("hypothalamus", drive);
    // Recompensa -> descarga fasica de dopamina (base del refuerzo).
    if (p.reward > 0.04) net.stimulateRegion("substantia_nigra", p.reward * 22);
    // Malestar (salud baja o deficit extremo) -> amigdala (alarma/estres).
    const distress =
      Math.max(0, 0.4 - p.health) * 2 +
      Math.max(0, p.hunger() - 0.82) * 3 +
      Math.max(0, p.thirst() - 0.82) * 3;
    if (distress > 0.05) net.stimulateRegion("amygdala", distress * 10);
  }

  // Consumir alimento: sube energia y dispara recompensa (dopamina).
  feed(amount = 0.35): void {
    this.physiology.eat(amount);
    this.network.stimulateRegion("substantia_nigra", 18);
    this.network.stimulateRegion("hypothalamus", 6);
  }

  // Beber: sube hidratacion y da recompensa.
  giveWater(amount = 0.35): void {
    this.physiology.drink(amount);
    this.network.stimulateRegion("substantia_nigra", 14);
  }

  toggleSleep(): void {
    if (this.physiology.asleep) this.physiology.wake();
    else this.physiology.sleep();
  }

  physiologySnapshot(): PhysiologyState {
    return this.physiology.snapshot();
  }

  stimulateRegion(name: string, current: number): void {
    this.network.stimulateRegion(name, current);
  }

  stimulateNeuron(id: number, current: number): void {
    this.network.stimulateNeuron(id, current);
  }

  motorSnapshot(): Record<MuscleChannel, number> {
    return this.motor.snapshot();
  }

  stats(): EngineStats {
    return {
      neurons: this.network.size,
      synapses: this.network.synapseCount,
      timeMs: this.network.time,
      firingHz: this.firingHzEma,
      activePulses: this.signals.count,
    };
  }
}
