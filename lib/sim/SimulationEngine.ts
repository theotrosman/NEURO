import { Network, NetworkOptions } from "../brain/Network";
import { MotorSystem, MuscleChannel } from "../body/MotorSystem";
import { Physiology, PhysiologyState } from "../body/Physiology";
import { Agent, AgentState } from "../body/Agent";
import { Environment, WorldState, ResourceKind } from "../world/Environment";
import { perceive, Perception } from "../body/Senses";
import { Plasticity } from "../brain/Plasticity";
import { Skills } from "../body/Skills";
import { SpatialMemory, MemorySite } from "../body/SpatialMemory";
import { SignalField } from "./SignalField";
import { DT } from "./constants";

// Presupuesto de pulsos visuales generados por fotograma (evita saturar).
const SPAWN_BUDGET = 70;

// A que distancia (unidades) el cuerpo alcanza y consume un recurso.
const REACH = 4;

export interface LearningState {
  motor: number; // 0..1 destreza motora aprendida
  neural: number; // 0..1 cuanto del movimiento genera el propio cerebro
  forageCount: number; // recursos conseguidos
  memorySites: number; // lugares recordados
  synActive: number; // sinapsis con elegibilidad viva
  potentiation: number; // cambio sinaptico acumulado
  enabled: boolean;
}

// Estado de los neuromoduladores globales ("drogas"). 1 = neutro.
export interface NeuromodState {
  excitability: number; // ganancia de la corriente excitatoria
  inhibition: number; // ganancia de la corriente inhibitoria (GABA)
  noise: number; // multiplicador del ruido de fondo
  dopamine: number; // 0..1 descarga tonica exogena de dopamina
}

function clamp1(x: number): number {
  return x < -1 ? -1 : x > 1 ? 1 : x;
}

function normAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

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
  plasticity: Plasticity;
  skills: Skills;
  memory: SpatialMemory;
  perception: Perception | null = null;

  private lastFrameSpikes = 0;
  private firingHzEma = 0;
  movementEffort = 0; // 0..1 esfuerzo motor del ultimo fotograma

  // --- Experimentos ---
  // Control manual: el usuario conduce el cuerpo y anula el reflejo innato.
  manualControl = false;
  private manualForward = 0;
  private manualTurn = 0;
  // Droga dopaminergica: descarga tonica exogena en el sistema de recompensa.
  dopamineLevel = 0;
  // Reward shaping de aproximacion: recuerda la distancia a la meta del ultimo
  // fotograma para premiar (con dopamina) el haberse acercado a ella.
  private lastGoalDist = -1;
  private lastWantKind: ResourceKind | null = null;

  constructor(opts: NetworkOptions = {}) {
    this.network = new Network(opts);
    this.motor = new MotorSystem(this.network);
    this.physiology = new Physiology();
    this.agent = new Agent();
    this.world = new Environment(opts.seed ?? 20260706);
    this.signals = new SignalField();
    // Capas de aprendizaje: plasticidad sinaptica (STDP + dopamina), destreza
    // motora procedimental y memoria espacial de tipo hipocampal.
    this.plasticity = new Plasticity(this.network);
    this.skills = new Skills();
    this.memory = new SpatialMemory();
  }

  // Avanza `steps` pasos de simulacion (cada uno DT ms).
  update(steps: number): void {
    const net = this.network;
    let budget = SPAWN_BUDGET;
    let frameSpikes = 0;

    for (let s = 0; s < steps; s++) {
      net.step();
      // STDP: tras cada paso, acumula trazas de elegibilidad segun las
      // coincidencias temporales pre/post de las neuronas que dispararon.
      this.plasticity.step();
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

    // --- Aprendizaje por refuerzo (regla de los tres factores) ---
    // La dopamina de la recompensa consolida las sinapsis que STDP dejo
    // elegibles: la red refuerza los caminos que precedieron algo bueno.
    this.plasticity.applyReward(p.reward, steps);
    // La misma recompensa afina la destreza motora; sin practica, se olvida.
    this.skills.reinforce(p.reward);
    this.skills.decay(simMs);
    this.memory.decay(simMs);

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

    // Droga dopaminergica (experimento): descarga tonica exogena en la sustancia
    // negra y los ganglios basales, mas un refuerzo artificial de la plasticidad
    // (euforia + aprendizaje acelerado, desligado de cualquier logro real).
    if (this.dopamineLevel > 0) {
      net.stimulateRegion("substantia_nigra", this.dopamineLevel * 30);
      net.stimulateRegion("basal_ganglia", this.dopamineLevel * 8);
      this.plasticity.applyReward(this.dopamineLevel * 0.5, steps);
    }

    // --- Percepcion, reflejo de orientacion y locomocion ---
    this.world.update(simMs);
    this.perceiveAndAct(simMs, m);
    // Si el cuerpo llega a un recurso, lo consume: comer sube energia, beber
    // sube hidratacion; ambos disparan recompensa (dopamina) via feed/giveWater.
    const got = this.world.consumeAt(this.agent.x, this.agent.z, REACH);
    if (got) {
      // Exito de forrajeo: consolida la destreza motora y GRABA el lugar en la
      // memoria espacial (hipocampo), para volver a el cuando lo necesite.
      this.skills.onForage();
      this.memory.remember(got, this.agent.x, this.agent.z);
      if (got === "food") this.feed();
      else this.giveWater();
    }
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

    // --- Control manual (experimento): el usuario toma el volante y anula el
    // reflejo. El cerebro sigue percibiendo y activo; solo la marcha la mandas tu.
    if (this.manualControl) {
      agent.setDrive(this.manualForward, this.manualTurn);
      agent.integrate(simMs);
      return;
    }

    // --- Reflejo innato de orientacion + memoria espacial (ANDAMIAJE) ---
    // Es el instinto con el que nace. Al principio manda casi todo el
    // movimiento; a medida que el cerebro aprende, le va cediendo el control.
    const urgency =
      need === "none" ? 0.3 : Math.min(1, Math.max(p.hunger(), p.thirst()));
    // Si necesita algo pero no lo ve, consulta si RECUERDA donde conseguirlo.
    const memSite =
      !percept.sees && wantKind
        ? this.memory.recall(wantKind, agent.x, agent.z)
        : null;
    let reflexForward: number;
    let reflexTurn: number;
    if (percept.sees && wantKind) {
      reflexTurn = clamp1(percept.bearing * 1.6);
      reflexForward = urgency * Math.max(0.15, Math.cos(percept.bearing));
    } else if (memSite) {
      const bearing = normAngle(
        Math.atan2(memSite.x - agent.x, memSite.z - agent.z) - agent.heading
      );
      reflexTurn = clamp1(bearing * 1.6);
      reflexForward = urgency * Math.max(0.2, Math.cos(bearing));
    } else {
      reflexTurn = need === "none" ? Math.sin(this.world.time * 0.0004) * 0.35 : 0.5;
      reflexForward = need === "none" ? 0.28 : 0.32;
    }

    // --- Salida motora GENERADA POR EL CEREBRO ---
    // Se lee de las motoneuronas de los miembros (via el sistema motor): la
    // asimetria izquierda/derecha ordena el giro y la actividad de las piernas
    // el avance. Al nacer es casi ruido; con el aprendizaje se vuelve movimiento
    // intencional. ESTO es moverse "con sus propias neuronas".
    const neuralTurn = clamp1(((m.armR + m.legR) - (m.armL + m.legL)) * 2.4);
    const neuralForward = clamp1((m.legL + m.legR) * 1.8);

    // --- Traspaso de control: instinto -> cerebro segun la competencia motora.
    // neuralWeight crece con la practica exitosa: el organismo pasa de moverse
    // por reflejo a conducir su cuerpo con la corteza motora que fue afinando.
    const w = this.skills.neuralWeight();
    let turn = clamp1((1 - w) * reflexTurn + w * neuralTurn);
    let forward = (1 - w) * reflexForward + w * neuralForward;
    // Impulso homeostatico: con hambre/sed el hipotalamo mantiene la marcha de
    // busqueda aunque la corteza motora aun no empuje (evita que se congele).
    if (need !== "none") forward = Math.max(forward, urgency * 0.16);

    // --- Torpeza motora: temblor y lentitud altos al nacer, minimos experto. ---
    const noise = this.skills.wanderNoise();
    turn = clamp1(turn * this.skills.turnMul() + (Math.random() - 0.5) * 2 * noise);
    forward = Math.min(1, Math.max(0, forward * this.skills.speedMul()));

    agent.setDrive(forward, turn);
    agent.integrate(simMs);

    // El cerebro aprende a conducir el cuerpo hacia lo que necesita.
    this.learnToApproach(wantKind, need, memSite, agent);
  }

  // Reward shaping: emite una pequena descarga de dopamina cada vez que el
  // cuerpo se ACERCA al recurso que necesita. Eso le da a la regla de los tres
  // factores un gradiente continuo de aprendizaje: refuerza las sinapsis
  // sensorio-motoras que produjeron el acercamiento, de modo que el cerebro
  // aprende, poco a poco, a mover el cuerpo hacia la meta (no solo a repetir lo
  // que ya funciono en el instante de comer).
  private learnToApproach(
    wantKind: ResourceKind | null,
    need: string,
    memSite: MemorySite | null,
    agent: Agent
  ): void {
    let goalDist = -1;
    if (wantKind && need !== "none") {
      const tgt =
        this.world.nearest(agent.x, agent.z, wantKind) ??
        (memSite ? { x: memSite.x, z: memSite.z } : null);
      if (tgt) goalDist = Math.hypot(tgt.x - agent.x, tgt.z - agent.z);
    }
    if (goalDist >= 0 && this.lastGoalDist >= 0 && this.lastWantKind === wantKind) {
      const delta = this.lastGoalDist - goalDist; // > 0 si se acerco
      if (delta > 0) {
        const approach = Math.min(0.4, delta * 0.25);
        this.plasticity.applyReward(approach, 1);
        this.network.stimulateRegion("substantia_nigra", approach * 12);
      }
    }
    this.lastGoalDist = goalDist;
    this.lastWantKind = wantKind;
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

  // Estado de las tres capas de aprendizaje (para el HUD).
  learningSnapshot(): LearningState {
    const ps = this.plasticity.stats();
    return {
      motor: this.skills.motor,
      neural: this.skills.neuralWeight(),
      forageCount: this.skills.forageCount,
      memorySites: this.memory.sites.length,
      synActive: ps.active,
      potentiation: ps.potentiation,
      enabled: ps.enabled,
    };
  }

  memorySnapshot(): MemorySite[] {
    return this.memory.snapshot();
  }

  // Congela / reactiva la plasticidad sinaptica (para comparar con/sin aprender).
  togglePlasticity(): void {
    this.plasticity.enabled = !this.plasticity.enabled;
  }

  // --- Experimentos: lesiones ---
  toggleLesion(name: string): boolean {
    return this.network.toggleLesion(name);
  }

  setLesion(name: string, on: boolean): void {
    this.network.setLesion(name, on);
  }

  isLesioned(name: string): boolean {
    return this.network.isLesioned(name);
  }

  healAll(): void {
    this.network.healAll();
  }

  // --- Experimentos: neuromoduladores / "drogas" ---
  setNeuromod(mod: Partial<NeuromodState>): void {
    if (mod.excitability !== undefined) this.network.excitability = mod.excitability;
    if (mod.inhibition !== undefined) this.network.inhibition = mod.inhibition;
    if (mod.noise !== undefined) this.network.noiseScale = mod.noise;
    if (mod.dopamine !== undefined) this.dopamineLevel = mod.dopamine;
  }

  neuromodSnapshot(): NeuromodState {
    return {
      excitability: this.network.excitability,
      inhibition: this.network.inhibition,
      noise: this.network.noiseScale,
      dopamine: this.dopamineLevel,
    };
  }

  clearNeuromod(): void {
    this.network.excitability = 1;
    this.network.inhibition = 1;
    this.network.noiseScale = 1;
    this.dopamineLevel = 0;
  }

  // --- Experimentos: control manual del organismo ---
  setManualControl(on: boolean): void {
    this.manualControl = on;
    if (!on) {
      this.manualForward = 0;
      this.manualTurn = 0;
    }
  }

  setManualDrive(forward: number, turn: number): void {
    this.manualForward = clamp1(forward);
    this.manualTurn = clamp1(turn);
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
