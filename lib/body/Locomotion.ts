// ============================================================================
//  LOCOMOCION NEUROMECANICA
// ----------------------------------------------------------------------------
//  Esto NO es una animacion. Es un cuerpo fisico (huesos, articulaciones, masa)
//  bajo gravedad, cuyos musculos los contraen IMPULSOS NERVIOSOS. El ritmo del
//  andar no se dibuja con un seno: EMERGE de un circuito neuronal (generador
//  central de patrones, CPG, de medio-centros a lo Matsuoka) acoplado al cuerpo
//  por un lazo sensitivo-motor:
//
//    drive descendente (tronco/MLR) -> los medio-centros flexor/extensor se
//    excitan y se INHIBEN mutuamente -> uno gana y contrae su musculo -> la
//    pierna se mueve bajo gravedad -> el musculo antagonista se ESTIRA -> su
//    aferente de estiramiento lo reexcita -> cambia la fase -> ...oscila.
//
//  La marcha, el equilibrio (pendulo invertido con gravedad real), el rebote,
//  las rodillas que ceden al apoyar y hasta la CAIDA salen de esa dinamica, no
//  de una curva prefijada. La corteza motora solo modula amplitud y asimetria
//  (girar, acelerar); el cerebelo/tronco dan el reflejo de enderezamiento.
// ============================================================================

// Señal motora descendente (voluntaria/cortical) por grupo muscular, 0..1.
// Viene de las motoneuronas reales (MotorSystem). Modula el CPG y da la postura
// de reposo; no dicta la cinematica del paso.
export interface DescendingDrive {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  core: number;
}

// Mando de alto nivel que el cerebro/fisiologia imponen al aparato locomotor.
export interface LocoCommand {
  desiredLoco: number; // 0..1 cuanto quiere avanzar (drive locomotor descendente)
  turn: number; // -1..1 giro deseado (asimetria de zancada)
  balance: number; // 0..1 integridad del reflejo de equilibrio (cerebelo/tronco/vestibular)
  vigor: number; // 0..1 vigor global (fatiga/quimica lo bajan)
  asleep: boolean;
  alive: boolean;
}

// Lo que el cuerpo le devuelve al cerebro cada paso (propiocepcion + vestibular).
// Cerrar este lazo es lo que permite SENTIR el cuerpo y aprender a usarlo.
export interface Proprioception {
  hipL: number; hipVelL: number; kneeL: number;
  hipR: number; hipVelR: number; kneeR: number;
  stretchFlexL: number; stretchExtL: number; // estiramiento muscular (aferentes Ia)
  stretchFlexR: number; stretchExtR: number;
  contactL: number; contactR: number; // carga plantar (0..1)
  lean: number; leanVel: number; // inclinacion sagital (vestibular)
  roll: number; // balanceo lateral
  loco: number; // intensidad de marcha efectiva
  fallen: number; // 0..1 esta desplomado
}

// Postura lista para renderizar (rotaciones en radianes tal cual las aplica el
// cuerpo 3D) + magnitudes de camara (rebote, balanceo, inclinacion).
export interface GaitPose {
  hipL: number; kneeL: number;
  hipR: number; kneeR: number;
  shoulderL: number; shoulderR: number;
  elbowL: number; elbowR: number;
  lean: number; roll: number; bob: number; sway: number;
  contactL: number; contactR: number; fallen: number;
  phase: number; loco: number; groundSpeed: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
function relu(x: number): number {
  return x > 0 ? x : 0;
}

// ---- Medio-centro (half-center) de un lado: oscilador neuronal de Matsuoka ----
// Dos poblaciones (flexora y extensora) que se auto-adaptan y se inhiben la una
// a la otra. Con drive tonico y un poco de realimentacion, alternan solas: ese
// es el ritmo del paso, generado por "impulsos", no por un reloj.
class HalfCenter {
  xf = 0.1; xe = -0.1; // potencial de cada poblacion
  vf = 0; ve = 0; // variable de adaptacion (fatiga de disparo)
  yf = 0; ye = 0; // salida rectificada (tasa de disparo 0..1)

  private readonly tau = 0.075; // constante de membrana (s)
  private readonly tauA = 0.42; // constante de adaptacion (s) -> marca el tempo
  private readonly beta = 2.6; // fuerza de adaptacion
  private readonly w = 2.2; // inhibicion reciproca flex<->ext

  // drive: excitacion tonica descendente. feedF/feedE: aferentes de estiramiento
  // que reexcitan al centro cuyo musculo esta estirado (entrenamiento sensorial).
  // crossF/crossE: acoplamiento contralateral (empuja hacia la antifase).
  step(dt: number, drive: number, feedF: number, feedE: number, crossF: number, crossE: number): void {
    const dxf = (-this.xf - this.w * this.ye - this.beta * this.vf + drive + feedF - crossF) / this.tau;
    const dxe = (-this.xe - this.w * this.yf - this.beta * this.ve + drive + feedE - crossE) / this.tau;
    this.xf += dxf * dt;
    this.xe += dxe * dt;
    this.yf = relu(this.xf);
    this.ye = relu(this.xe);
    this.vf += ((this.yf - this.vf) / this.tauA) * dt;
    this.ve += ((this.ye - this.ve) / this.tauA) * dt;
  }
}

// Longitudes de segmento (unidades de escena, del esqueleto en landmarks.ts).
const THIGH = 7.0;
const SHANK = 7.4;
const LEG = THIGH + SHANK;

// Cuanto avance (unidades/seg) produce el empuje del apoyo a marcha plena. El
// avance NO es un numero fijado a mano: es este empuje modulado por el paso.
const STRIDE_GAIN = 9.0;

// Angulos de reposo y amplitudes articulares (radianes).
const HIP_SWING = 0.62; // amplitud de flexo-extension de cadera al caminar
const KNEE_SWING = 1.25; // flexion de rodilla en fase de balanceo
const KNEE_REST = 0.06;

export class Locomotion {
  private cpgL = new HalfCenter();
  private cpgR = new HalfCenter();

  // Estado articular fisico (radianes) y sus velocidades.
  private hipL = 0; private hipVelL = 0;
  private hipR = 0; private hipVelR = 0;
  private kneeL = KNEE_REST; private kneeVelL = 0;
  private kneeR = KNEE_REST; private kneeVelR = 0;

  // Equilibrio: pendulo invertido sagital (lean) + balanceo lateral (roll).
  private lean = 0; private leanVel = 0;
  private roll = 0; private sway = 0; private bob = 0;

  // Caida y recuperacion.
  private fallen = 0; // 0..1 (interpolado para el render)
  private isDown = false;
  private downTimer = 0;

  private loco = 0; // intensidad de marcha suavizada
  private groundSpeed = 0; // unidades/seg producidas por el empuje del apoyo
  private phase = 0;
  private t = 0; // reloj interno para micro-movimientos de reposo

  // Contacto plantar suavizado.
  private contactL = 1;
  private contactR = 1;

  // ---- Constantes de la mecanica del equilibrio ----
  private readonly G_OVER_L = 9.0; // gravedad/altura: cuan rapido se cae si no corrige
  private readonly BAL_P = 16.0; // reflejo de enderezamiento (proporcional al angulo)
  private readonly BAL_D = 4.2; // amortiguacion refleja (proporcional a la velocidad)
  private readonly LEAN_DAMP = 1.4;
  private readonly FALL_LIMIT = 0.6; // rad: mas alla de aqui, se desploma
  private perturbSeed = 12.9898;

  // Ruido determinista barato para perturbaciones de equilibrio.
  private noise(): number {
    this.perturbSeed = (this.perturbSeed * 1.0001 + 0.017) % 6.2831853;
    return Math.sin(this.perturbSeed * 127.1) * 0.5 + Math.sin(this.perturbSeed * 311.7) * 0.5;
  }

  // Avanza la locomocion dt segundos de tiempo de simulacion.
  // Se sub-integra internamente para estabilidad ante fotogramas largos.
  step(dtSec: number, cmd: LocoCommand, drive: DescendingDrive): void {
    const dt = clamp(dtSec, 0, 0.1);
    if (dt <= 0) return;
    this.t += dt;

    // Dormido o muerto: se relaja/derrumba, sin marcha.
    const targetLoco =
      !cmd.alive ? 0 : cmd.asleep ? 0 : clamp(cmd.desiredLoco * cmd.vigor, 0, 1);
    this.loco += (targetLoco - this.loco) * clamp(dt * 3.5, 0, 1);

    // Sub-pasos fijos para la fisica (springs rigidos estables).
    const H = 0.004;
    let acc = dt;
    while (acc > 1e-6) {
      const h = acc < H ? acc : H;
      this.integrate(h, cmd, drive);
      acc -= h;
    }

    // Desplome objetivo (dormido/muerto) o caido -> interpola la bandera fallen.
    const wantDown =
      !cmd.alive ? 1 : cmd.asleep ? 0.75 : this.isDown ? 1 : 0;
    this.fallen += (wantDown - this.fallen) * clamp(dt * 4, 0, 1);
  }

  private integrate(h: number, cmd: LocoCommand, drive: DescendingDrive): void {
    // === 1) CPG: el ritmo neuronal ===
    // Drive locomotor descendente (MLR/tronco), modulado por lo que quiere andar
    // y por la señal motora cortical de cada pierna (asi la corteza puede pedir
    // mas paso). La asimetria de giro sube el drive de un lado (pierna externa
    // da mas zancada en la curva).
    const base = 0.25 + 1.15 * this.loco;
    const turn = clamp(cmd.turn, -1, 1);
    const driveL = base * (1 + 0.35 * turn) + drive.legL * 0.5;
    const driveR = base * (1 - 0.35 * turn) + drive.legR * 0.5;

    // Realimentacion de estiramiento (aferentes Ia): cuando la cadera esta muy
    // flexionada, el extensor esta estirado -> reexcita al extensor (y viceversa).
    // Esto ENGANCHA el ritmo a la mecanica del cuerpo: el pendulo pone el tempo.
    const kFeed = 1.1;
    const feedFL = kFeed * relu(-this.hipL / HIP_SWING); // cadera atras -> estira flexor
    const feedEL = kFeed * relu(this.hipL / HIP_SWING); // cadera adelante -> estira extensor
    const feedFR = kFeed * relu(-this.hipR / HIP_SWING);
    const feedER = kFeed * relu(this.hipR / HIP_SWING);

    // Acoplamiento contralateral: empuja las piernas a la antifase.
    const kCross = 0.9;
    this.cpgL.step(h, driveL, feedFL, feedEL, kCross * this.cpgR.yf, kCross * this.cpgR.ye);
    this.cpgR.step(h, driveR, feedFR, feedER, kCross * this.cpgL.yf, kCross * this.cpgL.ye);

    // === 2) Musculos -> torques -> articulaciones (springs impulsados) ===
    // La activacion flexora/extensora define el angulo OBJETIVO; la articulacion
    // lo persigue como un resorte criticamente amortiguado (tendon/musculo).
    const swingL = (this.cpgL.yf - this.cpgL.ye); // + flexion, - extension
    const swingR = (this.cpgR.yf - this.cpgR.ye);

    // Cadera: objetivo = balanceo * amplitud * cuanto camina, mas tono de reposo.
    const hipTgtL = swingL * HIP_SWING * this.loco - drive.legL * 0.25 * (1 - this.loco);
    const hipTgtR = swingR * HIP_SWING * this.loco - drive.legR * 0.25 * (1 - this.loco);
    this.driveJoint("hipL", hipTgtL, h, 180, 26);
    this.driveJoint("hipR", hipTgtR, h, 180, 26);

    // Rodilla: flexiona sobre todo en el balanceo (cadera yendo adelante), se
    // extiende en apoyo para sostener. Solo positiva (no hiperextiende).
    const kneeTgtL = KNEE_REST + relu(this.cpgL.yf) * KNEE_SWING * this.loco;
    const kneeTgtR = KNEE_REST + relu(this.cpgR.yf) * KNEE_SWING * this.loco;
    this.driveJoint("kneeL", kneeTgtL, h, 200, 28);
    this.driveJoint("kneeR", kneeTgtR, h, 200, 28);

    // === 3) Contacto plantar y empuje de avance ===
    // Un pie apoya cuando su pierna esta en extension (fase de apoyo) y la rodilla
    // razonablemente recta. La altura del pie sale de la geometria de la pierna.
    const footHL = this.footHeight(this.hipL, this.kneeL);
    const footHR = this.footHeight(this.hipR, this.kneeR);
    const lowL = clamp(1 - relu(footHL) * 1.2, 0, 1); // pie cerca del suelo
    const lowR = clamp(1 - relu(footHR) * 1.2, 0, 1);
    const stanceL = clamp((this.cpgL.ye - this.cpgL.yf) * 1.3, 0, 1) * lowL;
    const stanceR = clamp((this.cpgR.ye - this.cpgR.yf) * 1.3, 0, 1) * lowR;
    const rest = this.loco < 0.06 ? 1 : 0; // quieto -> ambos pies apoyan
    this.contactL += (Math.max(stanceL, rest) - this.contactL) * clamp(h * 22, 0, 1);
    this.contactR += (Math.max(stanceR, rest) - this.contactR) * clamp(h * 22, 0, 1);

    // El empuje del extensor de la pierna en apoyo propulsa el cuerpo adelante.
    // Solo cuenta si esta erguido (cae -> no avanza). ESTO liga paso y avance:
    // el empuje modula la velocidad (los pies no patinan), pero hay un piso de
    // deslizamiento para que una zancada torpe de recien nacido igual progrese.
    const upright = clamp(Math.cos(this.lean), 0, 1);
    const pushRaw = this.cpgL.ye * stanceL + this.cpgR.ye * stanceR;
    const pushNorm = clamp(pushRaw * 1.8, 0, 1);
    const targetSpeed = this.isDown
      ? 0
      : (0.4 + 0.6 * pushNorm) * this.loco * upright * STRIDE_GAIN;
    this.groundSpeed += (targetSpeed - this.groundSpeed) * clamp(h * 8, 0, 1);

    // === 4) Equilibrio: pendulo invertido con gravedad REAL ===
    // El cuerpo tiende a caer (gravedad); un reflejo vestibuloespinal innato lo
    // endereza. Si el reflejo es debil (cerebelo/tronco lesionado, depresores) o
    // la perturbacion grande, supera el limite y se DESPLOMA.
    if (!this.isDown) {
      const gTorque = Math.sin(this.lean) * this.G_OVER_L; // desestabiliza
      const base2 = this.contactL + this.contactR; // apoyo bipodal = base amplia
      const support = clamp(0.35 + 0.65 * clamp(base2, 0, 1), 0, 1);
      const reflex = cmd.balance * (this.BAL_P * this.lean + this.BAL_D * this.leanVel) * support;
      // Perturbaciones: leves al caminar; nulas si esta perfectamente quieto.
      const perturb = this.noise() * (0.3 + 1.0 * this.loco) * (1.15 - cmd.balance);
      const leanAcc = gTorque - reflex - this.LEAN_DAMP * this.leanVel + perturb;
      this.leanVel += leanAcc * h;
      this.lean += this.leanVel * h;
      if (cmd.alive && !cmd.asleep && Math.abs(this.lean) > this.FALL_LIMIT) {
        this.isDown = true;
        this.downTimer = 0;
      }
    } else {
      // Caido: se afloja al suelo; tras un momento se reincorpora (se levanta).
      this.lean += (Math.sign(this.lean) * 1.15 - this.lean) * clamp(h * 3, 0, 1);
      this.leanVel = 0;
      this.downTimer += h;
      if (this.downTimer > 1.3) {
        this.isDown = false;
        this.lean *= 0.15;
        this.leanVel = 0;
      }
    }
    if (!cmd.alive || cmd.asleep) {
      // Sin control postural activo: se relaja (no "cae" con alarma).
      this.isDown = false;
    }

    // === 5) Rebote, balanceo lateral y giro del CPG (para camara/postura) ===
    // Altura del centro de masa: sube en el apoyo medio (dos veces por zancada),
    // cede un poco al recibir el peso -> sensacion de gravedad.
    const bobTgt = (this.cpgL.ye * this.contactL + this.cpgR.ye * this.contactR) * 0.75 * this.loco;
    this.bob += (bobTgt - this.bob) * clamp(h * 12, 0, 1);
    // Balanceo lateral hacia la pierna que sostiene.
    const swayTgt = (this.contactR - this.contactL) * 0.55 * this.loco;
    this.sway += (swayTgt - this.sway) * clamp(h * 10, 0, 1);
    this.roll += (-(this.contactR - this.contactL) * 0.05 * this.loco - this.roll) * clamp(h * 10, 0, 1);

    // Fase (para HUD / continuidad visual): angulo del vector (swing, dSwing).
    this.phase = Math.atan2(swingL, this.cpgL.yf - this.cpgL.ye - swingL + 1e-3);
    if (this.phase < 0) this.phase += Math.PI * 2;
  }

  // Resorte criticamente amortiguado que lleva una articulacion a su objetivo.
  private driveJoint(
    which: "hipL" | "hipR" | "kneeL" | "kneeR",
    target: number,
    h: number,
    k: number,
    c: number
  ): void {
    let ang: number, vel: number;
    if (which === "hipL") { ang = this.hipL; vel = this.hipVelL; }
    else if (which === "hipR") { ang = this.hipR; vel = this.hipVelR; }
    else if (which === "kneeL") { ang = this.kneeL; vel = this.kneeVelL; }
    else { ang = this.kneeR; vel = this.kneeVelR; }

    const accel = k * (target - ang) - c * vel;
    vel += accel * h;
    ang += vel * h;

    if (which === "hipL") { this.hipL = ang; this.hipVelL = vel; }
    else if (which === "hipR") { this.hipR = ang; this.hipVelR = vel; }
    else if (which === "kneeL") { this.kneeL = Math.max(0, ang); this.kneeVelL = vel; }
    else { this.kneeR = Math.max(0, ang); this.kneeVelR = vel; }
  }

  // Altura del pie sobre el suelo neutro, a partir de la geometria de la pierna
  // (0 = apoyado; >0 = levantado). Aproximacion sagital: la pierna recta cuelga
  // a -LEG; flexionar cadera/rodilla sube el pie.
  private footHeight(hip: number, knee: number): number {
    const kneeY = -THIGH * Math.cos(hip);
    const footY = kneeY - SHANK * Math.cos(hip + knee);
    return (footY + LEG) / LEG; // 0 abajo del todo, ~1 muy arriba
  }

  // --- Propiocepcion: lo que el cuerpo le informa al sistema nervioso ---
  proprioception(): Proprioception {
    return {
      hipL: this.hipL, hipVelL: this.hipVelL, kneeL: this.kneeL,
      hipR: this.hipR, hipVelR: this.hipVelR, kneeR: this.kneeR,
      stretchFlexL: relu(-this.hipL / HIP_SWING), stretchExtL: relu(this.hipL / HIP_SWING),
      stretchFlexR: relu(-this.hipR / HIP_SWING), stretchExtR: relu(this.hipR / HIP_SWING),
      contactL: this.contactL, contactR: this.contactR,
      lean: this.lean, leanVel: this.leanVel, roll: this.roll,
      loco: this.loco, fallen: this.fallen,
    };
  }

  // --- Postura para el render (rotaciones listas para three.js) ---
  // Convencion (heredada de HumanBody): rotation.x NEGATIVA en la cadera lleva el
  // pie hacia +Z (adelante). Aqui hip>0 = flexion (pierna adelante), asi que la
  // rotacion de render es -hip. La rodilla positiva es flexion (rotation.x = +).
  pose(): GaitPose {
    const s = this.fallen; // desplome (dormido/caido/muerto)
    // Brazos: contrabalanceo contralateral (opuesto a la pierna del mismo lado)
    // + tono de reposo. Nace del acoplamiento del CPG, no de un seno aparte.
    const shoulderL = 0.7 * this.hipL - 0.15 * s;
    const shoulderR = 0.7 * this.hipR - 0.15 * s;
    const elbowL = -(0.3 + relu(-this.hipL) * 0.5) - 0.2 * s;
    const elbowR = -(0.3 + relu(-this.hipR) * 0.5) - 0.2 * s;

    return {
      hipL: -this.hipL, kneeL: this.kneeL,
      hipR: -this.hipR, kneeR: this.kneeR,
      shoulderL, shoulderR, elbowL, elbowR,
      lean: this.lean + 0.16 * s,
      roll: this.roll,
      bob: this.bob - 1.0 * s,
      sway: this.sway,
      contactL: this.contactL, contactR: this.contactR,
      fallen: s,
      phase: this.phase, loco: this.loco, groundSpeed: this.groundSpeed,
    };
  }

  get speed(): number {
    return this.groundSpeed;
  }
}
