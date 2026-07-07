"use client";

import { useEffect, useState } from "react";
import { useNeuro } from "./store";
import { PhysiologyState } from "../lib/body/Physiology";

const NEED_LABEL: Record<string, string> = {
  hunger: "Hambre",
  thirst: "Sed",
  tiredness: "Sueño",
  none: "Saciado",
};

// Panel de signos vitales: muestra el estado homeostatico del organismo en
// tiempo real y permite interactuar con sus necesidades.
export default function VitalsPanel() {
  const engine = useNeuro((s) => s.engine);
  const feed = useNeuro((s) => s.feed);
  const giveWater = useNeuro((s) => s.giveWater);
  const toggleSleep = useNeuro((s) => s.toggleSleep);
  const [p, setP] = useState<PhysiologyState | null>(null);

  useEffect(() => {
    if (!engine) return;
    const id = setInterval(() => setP(engine.physiologySnapshot()), 120);
    return () => clearInterval(id);
  }, [engine]);

  if (!p) return null;

  return (
    <div className="panel panel-vitals">
      <div className="section" style={{ marginTop: 0 }}>
        Signos vitales {p.asleep && <span className="badge">durmiendo</span>}
      </div>

      <Bar label="Energía" v={p.energy} color="#ffd23c" warn={0.2} />
      <Bar label="Hidratación" v={p.hydration} color="#4ad0ff" warn={0.2} />
      <Bar label="Salud" v={p.health} color="#3cff8a" warn={0.35} />
      <Bar label="Fatiga" v={p.fatigue} color="#ff7a3c" invert warn={0.75} />

      <div className="stat" style={{ marginTop: 8 }}>
        <span className="k">Edad</span>
        <span className="v">{p.age.toFixed(0)} s</span>
      </div>
      <div className="stat">
        <span className="k">Pulsión</span>
        <span className="v">{NEED_LABEL[p.need]}</span>
      </div>
      <div className="stat">
        <span className="k">Recompensa</span>
        <span
          className="v"
          style={{ color: p.reward >= 0 ? "#3cffd2" : "#ff5a8a" }}
        >
          {p.reward >= 0 ? "+" : ""}
          {p.reward.toFixed(2)}
        </span>
      </div>

      {!p.alive && (
        <div className="hint" style={{ color: "#ff5a8a" }}>
          El organismo ha muerto. Reconstruí la red para reiniciar la vida.
        </div>
      )}

      <div className="grid" style={{ marginTop: 10 }}>
        <button onClick={feed} disabled={!p.alive}>
          Alimentar
        </button>
        <button onClick={giveWater} disabled={!p.alive}>
          Dar agua
        </button>
      </div>
      <button
        className="wide"
        style={{ marginTop: 6 }}
        onClick={toggleSleep}
        disabled={!p.alive}
      >
        {p.asleep ? "Despertar" : "Dormir"}
      </button>
    </div>
  );
}

function Bar({
  label,
  v,
  color,
  warn,
  invert,
}: {
  label: string;
  v: number;
  color: string;
  warn: number;
  invert?: boolean;
}) {
  // `invert` para variables donde alto = malo (p.ej. fatiga).
  const danger = invert ? v > warn : v < warn;
  return (
    <div style={{ margin: "6px 0" }}>
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
        <span style={{ color: danger ? "#ff5a8a" : "var(--text)" }}>
          {Math.round(v * 100)}%
        </span>
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
            background: danger ? "#ff5a8a" : color,
            transition: "width 0.12s linear",
          }}
        />
      </div>
    </div>
  );
}
