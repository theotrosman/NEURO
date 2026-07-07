import { NEURON_TYPES, NeuronType, NeuronTypeName } from "./NeuronTypes";

// Constantes de decaimiento de la corriente sinaptica (ms).
// Excitatoria rapida (tipo AMPA/glutamato) e inhibitoria (tipo GABA-A).
const TAU_EXC = 5;
const TAU_INH = 6;

// Una neurona individual modelada segun Izhikevich (2003).
//
// Anatomia funcional representada:
//  - soma:      cuerpo celular -> integra el potencial de membrana `v`.
//  - dendritas: entradas -> corrientes sinapticas `iExc` / `iInh`.
//  - axon:      salida -> lista de sinapsis `out` hacia otras neuronas.
//
// Biofisica (unidades: v en mV, tiempo en ms):
//   v' = 0.04 v^2 + 5 v + 140 - u + I
//   u' = a (b v - u)
//   si v >= 30 mV:  se emite un potencial de accion (spike),
//                   v <- c ,  u <- u + d
export class Neuron {
  readonly id: number;
  readonly type: NeuronType;
  readonly typeName: NeuronTypeName;
  readonly region: number; // indice de la region cerebral
  readonly x: number;
  readonly y: number;
  readonly z: number;

  // Estado de membrana.
  v: number; // potencial de membrana (mV)
  u: number; // variable de recuperacion

  // Corrientes de entrada (dendritas).
  iExc = 0; // corriente excitatoria acumulada (decae)
  iInh = 0; // corriente inhibitoria acumulada (decae)
  iExt = 0; // corriente externa (estimulo / ruido de fondo)

  // Salida (axon): indices en el array global de sinapsis.
  out: number[] = [];
  outCount = 0;

  // Estado dinamico para simulacion y render.
  spiked = false; // disparo en el paso actual
  lastSpikeTime = -1e9; // ms del ultimo disparo
  spikeGlow = 0; // 0..1 destello visual que decae tras un spike
  fireRate = 0; // media movil de disparos (Hz aprox.) para salida motora

  constructor(
    id: number,
    typeName: NeuronTypeName,
    region: number,
    x: number,
    y: number,
    z: number
  ) {
    this.id = id;
    this.typeName = typeName;
    this.type = NEURON_TYPES[typeName];
    this.region = region;
    this.x = x;
    this.y = y;
    this.z = z;
    this.v = this.type.c; // reposo cerca del voltaje de reset
    this.u = this.type.b * this.v;
  }

  // Recibe corriente sinaptica desde un axon presinaptico.
  // `signedWeight` positivo = excitatorio, negativo = inhibitorio.
  receive(signedWeight: number): void {
    if (signedWeight >= 0) this.iExc += signedWeight;
    else this.iInh -= signedWeight; // guardamos como magnitud positiva
  }

  // Inyecta corriente externa (estimulo del usuario o marcapasos).
  stimulate(current: number): void {
    this.iExt += current;
  }

  // Avanza un paso de integracion de `dt` ms. Devuelve true si dispara.
  // Se usa el esquema de dos medios pasos de Izhikevich para estabilidad.
  step(dt: number, time: number, noise: number): boolean {
    const t = this.type;

    // Corriente total que ven las dendritas -> soma.
    const I = this.iExc - this.iInh + this.iExt + noise;

    // Integracion de la membrana (dos medios pasos).
    const half = 0.5 * dt;
    this.v += half * (0.04 * this.v * this.v + 5 * this.v + 140 - this.u + I);
    this.v += half * (0.04 * this.v * this.v + 5 * this.v + 140 - this.u + I);
    this.u += dt * t.a * (t.b * this.v - this.u);

    // Decaimiento exponencial de las corrientes sinapticas.
    this.iExc -= (this.iExc * dt) / TAU_EXC;
    this.iInh -= (this.iInh * dt) / TAU_INH;
    this.iExt *= 0.9; // el estimulo externo se disipa rapido

    // Decaimiento del destello y de la tasa de disparo.
    this.spikeGlow -= this.spikeGlow * dt * 0.08;
    this.fireRate -= this.fireRate * dt * 0.02;

    // Umbral de disparo.
    this.spiked = false;
    if (this.v >= 30) {
      this.v = t.c;
      this.u += t.d;
      this.spiked = true;
      this.lastSpikeTime = time;
      this.spikeGlow = 1;
      this.fireRate += 1;
      return true;
    }
    return false;
  }

  // Nivel de activacion normalizado 0..1 para el render (color/brillo).
  activation(): number {
    // Mezcla el potencial de membrana con el destello del spike.
    const membrane = Math.min(1, Math.max(0, (this.v + 75) / 105));
    return Math.min(1, membrane * 0.5 + this.spikeGlow);
  }
}
