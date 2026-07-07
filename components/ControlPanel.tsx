"use client";

import { useNeuro, ColorMode } from "./store";

const COLOR_MODES: { key: ColorMode; label: string }[] = [
  { key: "type", label: "Tipo" },
  { key: "region", label: "Region" },
  { key: "activity", label: "Actividad" },
];

const STIMULI: { label: string; region: string; current: number }[] = [
  { label: "Vision (retinas)", region: "retina_L", current: 70 },
  { label: "Tacto mano izq.", region: "skin_hand_L", current: 70 },
  { label: "Tacto mano der.", region: "skin_hand_R", current: 70 },
  { label: "Pensamiento (PFC)", region: "prefrontal", current: 40 },
  { label: "Orden motora", region: "motor_cortex", current: 45 },
  { label: "Talamo", region: "thalamus", current: 40 },
];

export default function ControlPanel() {
  const s = useNeuro();

  return (
    <div className="panel panel-left">
      <h1>NEURO</h1>
      <div className="subtitle">
        Cerebro humano simulado neurona a neurona (modelo de Izhikevich) y
        encarnado en 3D.
      </div>

      <div className="row">
        <button className="primary wide" onClick={s.togglePlay}>
          {s.running ? "⏸ Pausar" : "▶ Reanudar"}
        </button>
      </div>

      <label className="field">Velocidad de simulacion: {s.speed}x</label>
      <input
        type="range"
        min={1}
        max={12}
        step={1}
        value={s.speed}
        onChange={(e) => s.setSpeed(Number(e.target.value))}
      />

      <div className="section">Color de las neuronas</div>
      <div className="row">
        {COLOR_MODES.map((m) => (
          <button
            key={m.key}
            className={s.colorMode === m.key ? "active" : ""}
            onClick={() => s.setColorMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="section">Capas visibles</div>
      <div className="grid">
        <button className={s.showNeurons ? "active" : ""} onClick={() => s.toggle("showNeurons")}>
          Neuronas
        </button>
        <button className={s.showTracts ? "active" : ""} onClick={() => s.toggle("showTracts")}>
          Tractos
        </button>
        <button className={s.showPulses ? "active" : ""} onClick={() => s.toggle("showPulses")}>
          Impulsos
        </button>
        <button className={s.showBody ? "active" : ""} onClick={() => s.toggle("showBody")}>
          Cuerpo
        </button>
        <button className={s.showWorld ? "active" : ""} onClick={() => s.toggle("showWorld")}>
          Mundo
        </button>
      </div>

      <div className="section">Estimular (inyectar corriente)</div>
      <div className="grid">
        {STIMULI.map((st) => (
          <button key={st.label} onClick={() => s.stimulate(st.region, st.current)}>
            {st.label}
          </button>
        ))}
      </div>
      <div className="hint">
        Tambien podes hacer clic en los ojos, manos o pies del cuerpo para
        enviar una senal sensorial, o clic en cualquier neurona para excitarla.
      </div>

      <div className="section">Construccion de la red</div>
      <label className="field">Densidad de neuronas: {s.density.toFixed(2)}x</label>
      <input
        type="range"
        min={0.2}
        max={2}
        step={0.1}
        value={s.density}
        onChange={(e) => s.setParam("density", Number(e.target.value))}
      />
      <label className="field">Ganancia sinaptica: {s.gain.toFixed(2)}</label>
      <input
        type="range"
        min={0.4}
        max={2}
        step={0.05}
        value={s.gain}
        onChange={(e) => s.setParam("gain", Number(e.target.value))}
      />
      <label className="field">Ruido de fondo: {s.noise.toFixed(1)}</label>
      <input
        type="range"
        min={0}
        max={6}
        step={0.2}
        value={s.noise}
        onChange={(e) => s.setParam("noise", Number(e.target.value))}
      />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" style={{ flex: 1 }} onClick={() => s.rebuild()}>
          ↻ Reconstruir
        </button>
        <button
          onClick={() => s.rebuild({ seed: Math.floor(Math.random() * 1e9) })}
          title="Nueva semilla aleatoria"
        >
          🎲
        </button>
      </div>
    </div>
  );
}
