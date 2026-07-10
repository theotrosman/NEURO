import { Network } from "../brain/Network";
import { Proprioception } from "./Locomotion";

// ============================================================================
//  PROPIOCEPCION — el cuerpo le habla al sistema nervioso
// ----------------------------------------------------------------------------
//  Hasta ahora el cerebro estaba CIEGO a su propio cuerpo: movia los miembros
//  pero no sentia donde estaban ni si tocaban el suelo. Sin ese lazo no se puede
//  aprender a caminar (no hay señal de error). Aqui inyectamos, como corrientes
//  a las neuronas reales, lo que el cuerpo siente en cada paso:
//    - carga plantar    -> receptores del pie (se encienden al pisar)
//    - estiramiento/car. -> medula espinal (aferentes Ia/Ib de musculo y tendon)
//    - movimiento articular -> cerebelo (coordinacion fina)
//    - inclinacion/vaiven  -> tronco encefalico (equilibrio vestibular)
//    - todo el tacto corporal -> corteza somatosensorial (el "mapa del cuerpo")
//  Cerrar este lazo es lo que convierte al organismo en un cuerpo SENTIDO.
// ============================================================================

// Escalas de corriente por via (moderadas: mantienen el lazo vivo sin saturar).
const FOOT = 20; // contacto plantar -> receptores del pie
const SPINAL = 9; // estiramiento + carga -> medula
const CEREBELLUM = 7; // velocidad articular -> cerebelo
const VESTIBULAR = 8; // inclinacion -> tronco
const SOMATO = 5; // tacto/postura -> corteza somatosensorial

export class ProprioceptiveSystem {
  constructor(private net: Network) {}

  // Inyecta el estado corporal como estimulo sensorial real en la red.
  inject(p: Proprioception): void {
    const net = this.net;

    // --- Pies: los mecanorreceptores plantares disparan con la carga. Cada
    //     pisada enciende su pie: el cerebro SIENTE el contacto con el suelo. ---
    net.stimulateRegion("skin_foot_L", p.contactL * FOOT);
    net.stimulateRegion("skin_foot_R", p.contactR * FOOT);

    // --- Medula: husos musculares (Ia, estiramiento) + organos de Golgi (Ib,
    //     carga). Sustrato de los reflejos espinales y del control de la marcha. ---
    const spinal =
      (p.stretchFlexL + p.stretchExtL + p.stretchFlexR + p.stretchExtR) * 0.5 +
      (p.contactL + p.contactR) * 0.5;
    net.stimulateRegion("spinal_cord", spinal * SPINAL);

    // --- Cerebelo: recibe la velocidad de las articulaciones (copia eferente y
    //     realimentacion), base de la coordinacion y la correccion del error. ---
    const limbMotion =
      Math.abs(p.hipVelL) + Math.abs(p.hipVelR) + p.loco * 0.5;
    net.stimulateRegion("cerebellum", Math.min(2.5, limbMotion) * CEREBELLUM);

    // --- Tronco: señal vestibular (inclinacion y su velocidad). Alimenta el
    //     reflejo de enderezamiento; si el cuerpo se ladea, el tronco lo "nota". ---
    const tilt = Math.abs(p.lean) * 1.5 + Math.abs(p.leanVel) * 0.4;
    net.stimulateRegion("brainstem", Math.min(2.5, tilt) * VESTIBULAR);

    // --- Corteza somatosensorial: el mapa consciente del cuerpo (tacto +
    //     posicion). Integra contacto y estiramiento en la percepcion corporal. ---
    const bodySense = (p.contactL + p.contactR) * 0.4 + spinal * 0.3;
    net.stimulateRegion("somatosensory", Math.min(2.5, bodySense) * SOMATO);
  }
}
