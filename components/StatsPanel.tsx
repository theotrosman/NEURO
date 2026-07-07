"use client";

import { useEffect, useState } from "react";
import { useNeuro } from "./store";
import { NEURON_TYPES } from "../lib/neuron/NeuronTypes";
import { REGIONS } from "../lib/brain/regions";

interface Live {
  v: number;
  fireRate: number;
  type: string;
  region: string;
  transmitter: string;
  outCount: number;
}

export default function StatsPanel() {
  const stats = useNeuro((s) => s.stats);
  const selected = useNeuro((s) => s.selected);
  const engine = useNeuro((s) => s.engine);
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    if (selected == null || !engine) {
      setLive(null);
      return;
    }
    const id = setInterval(() => {
      const n = engine.network.neurons[selected];
      if (!n) return;
      setLive({
        v: n.v,
        fireRate: n.fireRate,
        type: NEURON_TYPES[n.typeName].label,
        region: REGIONS[n.region].label,
        transmitter: n.type.transmitter,
        outCount: n.outCount,
      });
    }, 90);
    return () => clearInterval(id);
  }, [selected, engine]);

  return (
    <div className="panel panel-right">
      <div className="section" style={{ marginTop: 0 }}>Estado de la red</div>
      <div className="stat"><span className="k">Neuronas</span><span className="v">{stats.neurons.toLocaleString()}</span></div>
      <div className="stat"><span className="k">Sinapsis</span><span className="v">{stats.synapses.toLocaleString()}</span></div>
      <div className="stat"><span className="k">Tasa de disparo</span><span className="v">{stats.firingHz.toFixed(1)} Hz</span></div>
      <div className="stat"><span className="k">Impulsos activos</span><span className="v">{stats.activePulses}</span></div>
      <div className="stat"><span className="k">Tiempo neural</span><span className="v">{(stats.timeMs / 1000).toFixed(2)} s</span></div>

      <div className="section">Neurona seleccionada</div>
      {live ? (
        <>
          <div className="stat"><span className="k">Region</span><span className="v" style={{ fontSize: 11 }}>{live.region}</span></div>
          <div className="stat"><span className="k">Tipo</span><span className="v" style={{ fontSize: 11 }}>{live.type}</span></div>
          <div className="stat"><span className="k">Neurotransmisor</span><span className="v">{live.transmitter}</span></div>
          <div className="stat"><span className="k">Axones salientes</span><span className="v">{live.outCount}</span></div>
          <div className="stat"><span className="k">Potencial (mV)</span><span className="v">{live.v.toFixed(1)}</span></div>
          <VoltageBar v={live.v} />
        </>
      ) : (
        <div className="hint">Hace clic en una neurona para inspeccionar su potencial de membrana en tiempo real.</div>
      )}
    </div>
  );
}

// Barra que representa el potencial de membrana entre -80 y +30 mV.
function VoltageBar({ v }: { v: number }) {
  const pct = Math.min(1, Math.max(0, (v + 80) / 110));
  return (
    <div style={{ marginTop: 8, height: 8, borderRadius: 6, background: "rgba(120,150,255,0.15)", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${pct * 100}%`,
          background: v > -10 ? "#ff5a3c" : "linear-gradient(90deg,#3a6bff,#3cffd2)",
          transition: "width 0.05s linear",
        }}
      />
    </div>
  );
}
