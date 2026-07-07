import { ARENA_R } from "../world/Environment";

// Cinematica del cuerpo en el mundo: posicion (x,z), orientacion (heading) y
// velocidad. No decide nada por si mismo; recibe "pulsiones motoras" (avanzar,
// girar) que en las capas superiores provienen del cerebro (reflejo innato y,
// mas adelante, habilidad aprendida).

export interface AgentState {
  x: number;
  z: number;
  heading: number; // radianes; 0 = mirando hacia +Z
  speed: number; // unidades/seg actuales
  moving: boolean;
}

const MAX_SPEED = 6; // unidades/seg a pleno esfuerzo
const TURN_RATE = 1.9; // rad/seg a pleno giro

export class Agent {
  x = 0;
  z = 0;
  heading = 0;
  speed = 0;

  private forwardDrive = 0; // -1..1 (atras..adelante)
  private turnDrive = 0; // -1..1 (izq..der)

  // Fija las pulsiones motoras para el proximo paso de integracion.
  setDrive(forward: number, turn: number): void {
    this.forwardDrive = Math.max(-1, Math.min(1, forward));
    this.turnDrive = Math.max(-1, Math.min(1, turn));
  }

  integrate(dtMs: number): void {
    const dt = dtMs / 1000;
    if (dt <= 0) return;

    // Girar hacia donde empuja la pulsion.
    this.heading += this.turnDrive * TURN_RATE * dt;

    // La velocidad persigue suavemente al objetivo (inercia del cuerpo).
    const targetSpeed = this.forwardDrive * MAX_SPEED;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 4);

    // Avanzar en la direccion de mirada.
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;

    // No salir del terreno: rebota suavemente contra el borde.
    const r = Math.hypot(this.x, this.z);
    const limit = ARENA_R - 2;
    if (r > limit) {
      const k = limit / r;
      this.x *= k;
      this.z *= k;
      this.speed *= 0.5;
    }
  }

  get moving(): boolean {
    return Math.abs(this.speed) > 0.15;
  }

  // Esfuerzo locomotor normalizado 0..1 (para el gasto metabolico).
  get effort(): number {
    return Math.min(1, Math.abs(this.speed) / MAX_SPEED);
  }

  snapshot(): AgentState {
    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      speed: this.speed,
      moving: this.moving,
    };
  }
}
