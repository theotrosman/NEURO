import { Environment, ResourceKind } from "../world/Environment";
import { Agent } from "./Agent";

// Vision del organismo: proyecta el mundo sobre dos "retinas" (izq/der) y
// localiza el recurso relevante dentro de un cono de vision hacia adelante.
// Es la entrada sensorial que alimenta al cerebro y al reflejo de orientacion.

export interface Perception {
  sees: boolean; // hay un objetivo dentro del cono de vision
  bearing: number; // -PI..PI, angulo al objetivo relativo al rumbo (0 = al frente)
  distance: number; // unidades al objetivo (Infinity si no ve nada)
  kind: ResourceKind | null;
  leftEye: number; // 0..1 estimulo en la retina izquierda
  rightEye: number; // 0..1 estimulo en la retina derecha
  brightness: number; // 0..1 luz ambiente percibida (dia/noche)
}

const VISION_RANGE = 75; // alcance de la vista (casi toda la arena)
const HALF_FOV = 1.15; // medio campo visual (~66°); total ~132°

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Percibe el entorno. `wantKind` es el recurso que el organismo necesita ahora
// (segun su pulsion dominante); si es null busca el recurso mas cercano.
export function perceive(
  agent: Agent,
  world: Environment,
  wantKind: ResourceKind | null
): Perception {
  const brightness = world.light;
  const target =
    world.nearest(agent.x, agent.z, wantKind ?? undefined) ??
    world.nearest(agent.x, agent.z);

  if (!target) {
    return {
      sees: false,
      bearing: 0,
      distance: Infinity,
      kind: null,
      leftEye: 0,
      rightEye: 0,
      brightness,
    };
  }

  const dx = target.x - agent.x;
  const dz = target.z - agent.z;
  const distance = Math.hypot(dx, dz);
  // Rumbo hacia el objetivo (0 = adelante = +Z; +X = derecha).
  const worldAngle = Math.atan2(dx, dz);
  const bearing = normalizeAngle(worldAngle - agent.heading);

  // Visibilidad: cae con la distancia y con la penumbra nocturna.
  const near = Math.max(0, 1 - distance / VISION_RANGE);
  const inCone = Math.abs(bearing) <= HALF_FOV;
  const sees = inCone && near > 0;
  // De noche se ve peor (la luz modula, sin anularla del todo).
  const acuity = near * (0.35 + 0.65 * brightness);

  // Estereo: el objeto a la derecha (+bearing) excita mas la retina derecha.
  const s = Math.sin(bearing);
  const leftEye = sees ? acuity * (0.5 - 0.5 * s) : 0;
  const rightEye = sees ? acuity * (0.5 + 0.5 * s) : 0;

  return {
    sees,
    bearing,
    distance,
    kind: target.kind,
    leftEye,
    rightEye,
    brightness,
  };
}
