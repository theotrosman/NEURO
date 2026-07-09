"use client";

import { useEffect, useState } from "react";
import { useNeuro } from "./store";
import Panel from "./Panel";
import { LearningState } from "../lib/sim/SimulationEngine";

// Muestra las tres capas de aprendizaje del organismo en tiempo real: destreza
// motora (cerebelo/estriado), memoria de lugares (hipocampo) y reconexion
// sinaptica por dopamina (STDP de tres factores).
export default function LearningPanel() {
  const engine = useNeuro((s) => s.engine);
  const togglePlasticity = useNeuro((s) => s.togglePlasticity);
  const [l, setL] = useState<LearningState | null>(null);

  useEffect(() => {
    if (!engine) return;
    const id = setInterval(() => setL(engine.learningSnapshot()), 200);
    return () => clearInterval(id);
  }, [engine]);

  if (!l) return null;

  return (
    <Panel title="Aprendizaje">
      <div className="hint" style={{ marginTop: 4 }}>
        El organismo nace sin saber moverse: un reflejo instintivo lo guía
        mientras su corteza motora aprende. Con cada acierto, el cerebro toma el
        control del cuerpo, recuerda dónde hay recursos y reconecta sus sinapsis.
      </div>

      <Meter label="Destreza motora" v={l.motor} color="#ffd23c" />
      <Meter label="Control neuronal del cuerpo" v={l.neural} color="#3cffd2" />

      <div className="stat" style={{ marginTop: 8 }}>
        <span className="k">Recursos conseguidos</span>
        <span className="v">{l.forageCount}</span>
      </div>
      <div className="stat">
        <span className="k">Lugares recordados</span>
        <span className="v">{l.memorySites}</span>
      </div>
      <div className="stat">
        <span className="k">Sinapsis plásticas</span>
        <span className="v">{l.synActive.toLocaleString()}</span>
      </div>
      <div className="stat">
        <span className="k">Cambio sináptico</span>
        <span className="v">{l.potentiation.toFixed(1)}</span>
      </div>

      <button
        className={`wide ${l.enabled ? "active" : ""}`}
        style={{ marginTop: 10 }}
        onClick={togglePlasticity}
      >
        Plasticidad: {l.enabled ? "aprendiendo" : "congelada"}
      </button>
    </Panel>
  );
}

function Meter({
  label,
  v,
  color,
}: {
  label: string;
  v: number;
  color: string;
}) {
  return (
    <div style={{ margin: "8px 0 2px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-dim)",
          marginBottom: 3,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--text)" }}>{Math.round(v * 100)}%</span>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 6,
          background: "rgba(120,150,255,0.14)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${v * 100}%`,
            background: color,
            transition: "width 0.2s linear",
          }}
        />
      </div>
    </div>
  );
}
