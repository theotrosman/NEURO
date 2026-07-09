// Homeostasis: el estado biologico interno del organismo.
//
// Modela las variables que un ser vivo debe mantener en equilibrio (energia,
// hidratacion, descanso, salud) y las convierte en:
//   - PULSIONES (drives): senales de necesidad que motivan la conducta.
//   - RECOMPENSA (reward): senal tipo dopamina que aparece cuando una
//     necesidad se satisface; sirve de base para el aprendizaje por refuerzo.
//
// La metafora biologica: el hipotalamo vigila estas variables y dispara
// hambre/sed; el sistema de recompensa (dopamina) marca lo que fue bueno.

export type Need = "hunger" | "thirst" | "tiredness" | "none";

export interface PhysiologyState {
  energy: number; // 0..1 (glucosa / reservas)
  hydration: number; // 0..1
  fatigue: number; // 0..1 (0 descansado, 1 agotado)
  health: number; // 0..1
  temperature: number; // 0..1 (0.5 = normotermia)
  age: number; // segundos de simulacion vividos
  reward: number; // -1..1 senal instantanea de recompensa/castigo
  asleep: boolean;
  need: Need; // pulsion dominante
  alive: boolean;
}

// --- Tasas por milisegundo de simulacion (ajustadas para un demo observable:
//     una necesidad pasa de saciada a urgente en decenas de segundos sim). ---
// Ajustadas para que el organismo pueda CRUZAR el terreno hasta un recurso y
// alimentarse de forma sostenible (una comida rinde ~0.35 de energia): forrajear
// no debe costar mas de lo que aporta. Aun asi una necesidad pasa de saciada a
// urgente en ~30 s de simulacion en reposo.
const BASE_METAB = 0.000008; // gasto energetico basal
const MOVE_METAB = 0.00002; // gasto extra por locomocion/esfuerzo
const NEURAL_METAB = 0.000003; // el cerebro consume energia al disparar
const HYDRO_RATE = 0.000007; // perdida de agua
const FATIGUE_RATE = 0.0000038; // cansancio por estar despierto
const FATIGUE_MOVE = 0.000008; // cansancio extra por moverse
const SLEEP_RECOVERY = 0.0002; // recuperacion de fatiga durmiendo (siestas breves)
const HEALTH_LOSS = 0.00006; // dano por deficit critico
const HEALTH_REGEN = 0.0000075; // curacion lenta si todo esta bien
const REWARD_GAIN = 60; // convierte cambio de bienestar en recompensa

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export class Physiology {
  energy = 0.82;
  hydration = 0.82;
  fatigue = 0.08;
  health = 1;
  temperature = 0.5;
  age = 0;
  asleep = false;
  alive = true;

  // Recompensa instantanea (se lee y decae cada paso).
  reward = 0;
  private phasic = 0; // recompensa de evento (comer/beber), decae
  private prevWellbeing = 0.8;

  // Contadores para el HUD.
  meals = 0;
  drinks = 0;

  constructor() {
    this.prevWellbeing = this.wellbeing();
  }

  // Avanza el metabolismo. `movement` 0..1 esfuerzo motor, `neural` 0..1
  // actividad neuronal normalizada.
  update(dtMs: number, movement: number, neural: number): void {
    if (!this.alive) return;
    const dt = dtMs;

    if (this.asleep) {
      this.fatigue = clamp01(this.fatigue - dt * SLEEP_RECOVERY);
      this.energy = clamp01(this.energy - dt * BASE_METAB * 0.45);
      // Despierta tras una siesta breve, descansado, para retomar la actividad.
      if (this.fatigue < 0.3) this.asleep = false;
    } else {
      const cost = BASE_METAB + movement * MOVE_METAB + neural * NEURAL_METAB;
      this.energy = clamp01(this.energy - dt * cost);
      this.fatigue = clamp01(
        this.fatigue + dt * (FATIGUE_RATE + movement * FATIGUE_MOVE)
      );
      // Agotamiento: si el cansancio llega al limite, el organismo cae dormido
      // por si mismo (como un ser vivo). Asi se autorregula y no queda congelado
      // ni muere exhausto; tras la siesta retoma la busqueda y el aprendizaje.
      if (this.fatigue >= 0.9) this.asleep = true;
    }

    this.hydration = clamp01(this.hydration - dt * HYDRO_RATE);

    // Salud: cae con deficits criticos, se recupera lentamente si todo va bien.
    const stress =
      Math.max(0, 0.18 - this.energy) + Math.max(0, 0.18 - this.hydration);
    if (stress > 0) this.health = clamp01(this.health - dt * stress * HEALTH_LOSS * 5);
    else if (this.fatigue < 0.6)
      this.health = clamp01(this.health + dt * HEALTH_REGEN);

    if (this.health <= 0) {
      this.alive = false;
      this.health = 0;
    }

    this.age += dtMs / 1000;

    // Recompensa = cambio de bienestar + evento fasico (comer/beber), acotada.
    this.phasic *= 0.9;
    const wb = this.wellbeing();
    const delta = (wb - this.prevWellbeing) * REWARD_GAIN;
    this.prevWellbeing = wb;
    this.reward = Math.max(-1, Math.min(1, delta + this.phasic));
  }

  eat(amount: number): void {
    const before = this.energy;
    this.energy = clamp01(this.energy + amount);
    // Cuanta mas hambre habia, mayor el placer de comer (recompensa saliente).
    this.phasic += (this.energy - before) * (0.5 + this.hunger()) * 3;
    this.meals++;
  }

  drink(amount: number): void {
    const before = this.hydration;
    this.hydration = clamp01(this.hydration + amount);
    this.phasic += (this.hydration - before) * (0.5 + this.thirst()) * 3;
    this.drinks++;
  }

  sleep(): void {
    this.asleep = true;
  }

  wake(): void {
    this.asleep = false;
  }

  // Bienestar global (0..1): mezcla ponderada de las variables vitales.
  wellbeing(): number {
    return (
      0.38 * this.energy +
      0.28 * this.hydration +
      0.22 * this.health +
      0.12 * (1 - this.fatigue)
    );
  }

  hunger(): number {
    return 1 - this.energy;
  }
  thirst(): number {
    return 1 - this.hydration;
  }
  tiredness(): number {
    return this.fatigue;
  }

  // Pulsion dominante: la necesidad mas urgente por encima de un umbral.
  dominantNeed(): Need {
    const h = this.hunger();
    const t = this.thirst();
    const f = this.fatigue;
    // Supervivencia primero: un deficit critico de energia o agua se antepone al
    // descanso (no se duerme mientras se muere de hambre). Sin esto, el sueno
    // puede monopolizar la conducta y dejar que el organismo muera de inanicion.
    if (this.energy < 0.32 || this.hydration < 0.32) {
      return this.hunger() >= this.thirst() ? "hunger" : "thirst";
    }
    const max = Math.max(h, t, f);
    if (max < 0.4) return "none";
    if (max === h) return "hunger";
    if (max === t) return "thirst";
    return "tiredness";
  }

  snapshot(): PhysiologyState {
    return {
      energy: this.energy,
      hydration: this.hydration,
      fatigue: this.fatigue,
      health: this.health,
      temperature: this.temperature,
      age: this.age,
      reward: this.reward,
      asleep: this.asleep,
      need: this.dominantNeed(),
      alive: this.alive,
    };
  }
}
