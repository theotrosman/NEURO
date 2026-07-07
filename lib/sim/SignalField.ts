// Impulsos que viajan visiblemente a lo largo de los tractos (axones largos).
// Cada pulso recorre una sinapsis desde el soma presinaptico al postsinaptico
// durante su tiempo de retardo, materializando la propagacion de la senal.
const MAX_PULSES = 1400;

export class SignalField {
  synId: Int32Array = new Int32Array(MAX_PULSES);
  elapsed: Float32Array = new Float32Array(MAX_PULSES);
  dur: Float32Array = new Float32Array(MAX_PULSES);
  alive: Uint8Array = new Uint8Array(MAX_PULSES);
  count = 0;
  private cursor = 0;

  spawn(synId: number, durMs: number): void {
    // Buffer circular: si esta lleno, se sobrescribe el mas antiguo.
    const i = this.cursor;
    this.synId[i] = synId;
    this.elapsed[i] = 0;
    this.dur[i] = Math.max(1, durMs);
    this.alive[i] = 1;
    this.cursor = (this.cursor + 1) % MAX_PULSES;
    if (this.count < MAX_PULSES) this.count++;
  }

  update(dtMs: number): void {
    for (let i = 0; i < this.count; i++) {
      if (!this.alive[i]) continue;
      this.elapsed[i] += dtMs;
      if (this.elapsed[i] >= this.dur[i]) this.alive[i] = 0;
    }
  }

  // Progreso 0..1 del pulso i (o -1 si esta muerto).
  progress(i: number): number {
    if (!this.alive[i]) return -1;
    return this.elapsed[i] / this.dur[i];
  }
}
