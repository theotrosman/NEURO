import { Network, NetworkOptions } from "../brain/Network";
import { MotorSystem, MuscleChannel } from "../body/MotorSystem";
import { Physiology, PhysiologyState } from "../body/Physiology";
import { Agent, AgentState } from "../body/Agent";
import { Environment, WorldState } from "../world/Environment";
import { perceive, Perception } from "../body/Senses";
import { SignalField } from "./SignalField";
import { DT } from "./constants";

// Presupuesto de pulsos visuales generados por fotograma (evita saturar).
const SPAWN_BUDGET = 70;

// A que distancia (unidades) el cuerpo alcanza y consume un recurso.
const REACH = 4;

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
  agent: Agent;
  world: Environment;
  perception: Perception | null = null;

  private lastFrameSpikes = 0;
  private firingHzEma = 0;
  movementEffort = 0; // 0..1 esfuerzo motor del ultimo fotograma

  constructor(opts: NetworkOptions = {}) {
    this.network = new Network(opts);
    this.motor = new MotorSystem(this.network);
    this.physiology = new Physiology();
    this.agent = new Agent();
    this.world = new Environment(opts.seed ?? 20260706);
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
    // El gasto motor combina la contraccion muscular y el desplazamiento real
    // del cuerpo por el terreno (caminar cuesta energia).
    const motorEffort =
      (m.legL + m.legR) * 0.5 + (m.armL + m.armR) * 0.25 + m.core * 0.1;
    const movement = Math.min(1, motorEffort + this.agent.effort * 0.6);
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

    // --- Percepcion, reflejo de orientacion y locomocion ---
    this.world.update(simMs);
    this.perceiveAndAct(simMs, m);
    // Si el cuerpo llega a un recurso, lo consume: comer sube energia, beber
    // sube hidratacion; ambos disparan recompensa (dopamina) via feed/giveWater.
    const got = this.world.consumeAt(this.agent.x, this.agent.z, REACH);
    if (got === "food") this.feed();
    else if (got === "water") this.giveWater();
  }

  // Percepcion del entorno + reflejo innato de orientacion (nivel tectal/tronco,
  // como el coliculo superior que gira el cuerpo hacia un estimulo saliente) con
  // un aporte cortical del sistema motor. Traduce todo en pulsiones de marcha y
  // desplaza el cuerpo por el mundo.
  private perceiveAndAct(simMs: number, m: Record<MuscleChannel, number>): void {
    const p = this.physiology;
    const agent = this.agent;
    const net = this.network;

    if (!p.alive) {
      agent.setDrive(0, 0);
      agent.integrate(simMs);
      return;
    }

    // El recurso que necesita segun su pulsion dominante.
    const need = p.dominantNeed();
    const wantKind =
      need === "hunger" ? "food" : need === "thirst" ? "water" : null;
    const percept = perceive(agent, this.world, wantKind);
    this.perception = percept;

    // Vision -> retinas: entrada sensorial real a la red, mas la luz ambiente.
    const VIS = 16;
    net.stimulateRegion("retina_L", percept.leftEye * VIS + percept.brightness * 0.8);
    net.stimulateRegion("retina_R", percept.rightEye * VIS + percept.brightness * 0.8);

    // Dormido: el cuerpo no camina (el metabolismo y la recuperacion continuan).
    if (p.asleep) {
      agent.setDrive(0, 0);
      agent.integrate(simMs);
      return;
    }

    // --- Reflejo innato de orientacion ---
    const urgency =
      need === "none" ? 0.3 : Math.min(1, Math.max(p.hunger(), p.thirst()));
    let forward: number;
    let turn: number;
    if (percept.sees && wantKind) {
      // Gira hacia el objetivo; avanza cuando lo tiene aproximadamente de frente.
      turn = Math.max(-1, Math.min(1, percept.bearing * 1.6));
      forward = urgency * Math.max(0.15, Math.cos(percept.bearing));
    } else {
      // No lo ve: barre el entorno buscando (giro sostenido) y avanza despacio.
      turn = need === "none" ? Math.sin(this.world.time * 0.0004) * 0.35 : 0.5;
      forward = need === "none" ? 0.28 : 0.32;
    }

    // --- Aporte cortical: la salida motora del cerebro perturba la marcha
    // (embodiment; el aprendizaje posterior reforzara lo util). ---
    const CORTICAL = 0.6;
    const corticalTurn = (m.armR - m.armL) * 0.5 + (m.legR - m.legL) * 0.8;
    const corticalGo = (m.legL + m.legR) * 0.5;
    turn = Math.max(-1, Math.min(1, turn + corticalTurn * CORTICAL));
    forward = Math.min(1, forward + corticalGo * CORTICAL);

    agent.setDrive(forward, turn);
    agent.integrate(simMs);
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

  worldSnapshot(): WorldState {
    return this.world.snapshot();
  }

  agentSnapshot(): AgentState {
    return this.agent.snapshot();
  }

  perceptionSnapshot(): Perception | null {
    return this.perception;
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
