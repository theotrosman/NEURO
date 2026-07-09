// Aprendizaje motor procedimental: con la practica exitosa el organismo aprende
// a controlar mejor su cuerpo. Al principio es torpe y lento; cada recurso que
// consigue (y cada descarga de dopamina) consolida la destreza, como el
// aprendizaje cerebeloso/estriatal de una habilidad motora.

export interface SkillState {
  motor: number; // 0..1 destreza motora
  forageCount: number; // recursos conseguidos (practica acumulada)
}

export class Skills {
  motor = 0.05; // nace casi sin control del cuerpo
  forageCount = 0;

  // Consolidacion continua por recompensa (dopamina de bienestar/consumo).
  reinforce(reward: number): void {
    if (reward > 0.05) this.motor = Math.min(1, this.motor + reward * 0.02);
  }

  // Exito discreto: conseguir un recurso es un ensayo de practica muy valioso.
  onForage(): void {
    this.forageCount++;
    this.motor = Math.min(1, this.motor + 0.035);
  }

  // Olvido lento si deja de practicar.
  decay(dtMs: number): void {
    this.motor = Math.max(0.05, this.motor - dtMs * 0.0000006);
  }

  // --- Efectos de la destreza sobre el cuerpo ---
  // Velocidad util: torpe (60%) -> agil (100%).
  speedMul(): number {
    return 0.6 + 0.4 * this.motor;
  }
  // Precision del giro: mejora con la practica.
  turnMul(): number {
    return 0.7 + 0.3 * this.motor;
  }
  // Temblor/erratismo de la marcha: alto cuando es torpe, casi nulo experto.
  wanderNoise(): number {
    return 0.35 * (1 - this.motor);
  }

  snapshot(): SkillState {
    return { motor: this.motor, forageCount: this.forageCount };
  }
}
