// Puntos de referencia anatomicos del cuerpo, en coordenadas de escena.
// Eje X: izquierda(-)/derecha(+).  Eje Y: abajo(-)/arriba(+).  Eje Z: atras(-)/adelante(+).
// El cuerpo mide ~30 unidades: pies en y=-15, cabeza arriba.
export type Vec3 = [number, number, number];

export const LANDMARKS = {
  headCenter: [0, 13, 0] as Vec3,
  eyeL: [-1.0, 13.4, 2.2] as Vec3,
  eyeR: [1.0, 13.4, 2.2] as Vec3,
  neck: [0, 10.2, 0] as Vec3,
  chest: [0, 7.5, 0.2] as Vec3,
  spineBase: [0, 1.5, -0.3] as Vec3,
  pelvis: [0, 0, 0] as Vec3,

  shoulderL: [-3.0, 9.0, 0] as Vec3,
  shoulderR: [3.0, 9.0, 0] as Vec3,
  elbowL: [-5.4, 5.0, 0.4] as Vec3,
  elbowR: [5.4, 5.0, 0.4] as Vec3,
  handL: [-6.6, 1.4, 0.9] as Vec3,
  handR: [6.6, 1.4, 0.9] as Vec3,

  hipL: [-1.7, -0.3, 0] as Vec3,
  hipR: [1.7, -0.3, 0] as Vec3,
  kneeL: [-1.9, -7.3, 0.5] as Vec3,
  kneeR: [1.9, -7.3, 0.5] as Vec3,
  footL: [-2.0, -14.6, 1.3] as Vec3,
  footR: [2.0, -14.6, 1.3] as Vec3,
};

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function dist3(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
