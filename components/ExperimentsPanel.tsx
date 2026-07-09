"use client";

import { useEffect } from "react";
import { useNeuro, DRUGS } from "./store";
import Panel from "./Panel";

// Regiones que se pueden lesionar (apagar) desde el laboratorio. Etiquetas
// cortas para caber en la rejilla; el nombre tecnico va al motor.
const LESIONS: { name: string; label: string }[] = [
  { name: "prefrontal", label: "Prefrontal" },
  { name: "motor_cortex", label: "Motora" },
  { name: "occipital", label: "Visual" },
  { name: "somatosensory", label: "Somatosens." },
  { name: "parietal", label: "Parietal" },
  { name: "thalamus", label: "Tálamo" },
  { name: "hippocampus", label: "Hipocampo" },
  { name: "amygdala", label: "Amígdala" },
  { name: "basal_ganglia", label: "G. basales" },
  { name: "substantia_nigra", label: "S. negra" },
  { name: "cerebellum", label: "Cerebelo" },
  { name: "brainstem", label: "Tronco" },
];

const DRIVE_KEYS = [
  "w", "a", "s", "d",
  "arrowup", "arrowdown", "arrowleft", "arrowright",
];

// Laboratorio: intervenir el cerebro vivo y ver la conducta cambiar en tiempo
// real. Tres experimentos: lesionar regiones, inyectar neuromoduladores
// ("drogas") y tomar el control manual del cuerpo.
export default function ExperimentsPanel() {
  const lesions = useNeuro((s) => s.lesions);
  const toggleLesion = useNeuro((s) => s.toggleLesion);
  const healAll = useNeuro((s) => s.healAll);
  const drug = useNeuro((s) => s.drug);
  const applyDrug = useNeuro((s) => s.applyDrug);
  const manualControl = useNeuro((s) => s.manualControl);
  const toggleManual = useNeuro((s) => s.toggleManual);
  const setManualDrive = useNeuro((s) => s.setManualDrive);

  // Control manual: traduce las teclas mantenidas (WASD / flechas) en pulsiones
  // de marcha continuas. Solo escucha mientras el control manual esta activo.
  useEffect(() => {
    if (!manualControl) return;
    const held = new Set<string>();
    const apply = () => {
      let f = 0;
      let t = 0;
      if (held.has("w") || held.has("arrowup")) f += 1;
      if (held.has("s") || held.has("arrowdown")) f -= 1;
      if (held.has("d") || held.has("arrowright")) t += 1;
      if (held.has("a") || held.has("arrowleft")) t -= 1;
      setManualDrive(f, t);
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!DRIVE_KEYS.includes(k)) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      e.preventDefault();
      held.add(k);
      apply();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (held.delete(k)) apply();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      setManualDrive(0, 0);
    };
  }, [manualControl, setManualDrive]);

  const anyLesion = Object.values(lesions).some(Boolean);
  const activeDrug = DRUGS.find((d) => d.key === drug) ?? null;

  return (
    <Panel title="Laboratorio">
      <div className="hint" style={{ marginTop: 4 }}>
        Intervení el cerebro vivo y mirá cómo cambia la conducta del organismo.
      </div>

      {/* --- Lesiones --- */}
      <div className="section">Lesionar regiones (apagar)</div>
      <div className="grid">
        {LESIONS.map((r) => (
          <button
            key={r.name}
            className={lesions[r.name] ? "lesion-on" : ""}
            onClick={() => toggleLesion(r.name)}
            title={`Apagar / reactivar: ${r.label}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <button
        className="wide"
        style={{ marginTop: 8 }}
        onClick={healAll}
        disabled={!anyLesion}
      >
        ✚ Sanar todo
      </button>

      {/* --- Neuromoduladores / drogas --- */}
      <div className="section">Inyectar neuromodulador</div>
      <div className="grid">
        {DRUGS.map((d) => (
          <button
            key={d.key}
            className={drug === d.key ? "active" : ""}
            style={
              drug === d.key
                ? { borderColor: d.color, color: d.color }
                : undefined
            }
            onClick={() => applyDrug(d)}
            title={d.desc}
          >
            {d.label}
          </button>
        ))}
      </div>
      {activeDrug ? (
        <div className="hint" style={{ marginTop: 6, color: activeDrug.color }}>
          {activeDrug.desc}
        </div>
      ) : (
        <div className="hint" style={{ marginTop: 6 }}>
          Sobrio. Tocá una droga para alterar la química global (volvé a tocarla
          para revertir).
        </div>
      )}

      {/* --- Control manual --- */}
      <div className="section">Control manual del cuerpo</div>
      <button
        className={`wide ${manualControl ? "active" : ""}`}
        onClick={toggleManual}
      >
        {manualControl ? "🕹 Control manual: ACTIVO" : "🕹 Tomar el control"}
      </button>
      <div className="hint" style={{ marginTop: 6 }}>
        {manualControl
          ? "Conducí con W A S D o las flechas. El reflejo innato queda anulado; el cerebro sigue percibiendo y activo."
          : "Anula el reflejo de forrajeo y manejás vos al organismo por el mundo."}
      </div>
    </Panel>
  );
}
