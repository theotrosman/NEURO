"use client";

import { useNeuro } from "./store";
import { NEURON_TYPES } from "../lib/neuron/NeuronTypes";
import { REGIONS } from "../lib/brain/regions";
import { NEUROTRANSMITTERS } from "../lib/neuron/Neurotransmitter";

export default function Legend() {
  const colorMode = useNeuro((s) => s.colorMode);

  let items: { label: string; color: string }[];
  if (colorMode === "region") {
    // Regiones unicas (evita duplicar temporal izq/der con mismo color).
    const seen = new Set<string>();
    items = [];
    for (const r of REGIONS) {
      if (seen.has(r.color)) continue;
      seen.add(r.color);
      items.push({ label: r.label, color: r.color });
    }
  } else if (colorMode === "activity") {
    items = [
      { label: "Reposo (hiperpolarizado)", color: "#3a6bff" },
      { label: "Despolarizando", color: "#b0a03c" },
      { label: "Disparo (spike)", color: "#ff5a3c" },
    ];
  } else {
    items = Object.values(NEURON_TYPES).map((t) => ({ label: t.label, color: t.color }));
  }

  return (
    <div className="panel panel-legend">
      <div className="section" style={{ marginTop: 0 }}>
        Leyenda {colorMode === "type" ? "· tipos de neurona" : colorMode === "region" ? "· regiones" : "· actividad"}
      </div>
      <div style={{ maxHeight: 190, overflowY: "auto" }}>
        {items.map((it) => (
          <div className="legend-item" key={it.label}>
            <span className="dot" style={{ background: it.color, color: it.color }} />
            {it.label}
          </div>
        ))}
      </div>
      <div className="section">Impulsos por neurotransmisor</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
        {Object.values(NEUROTRANSMITTERS).map((nt) => (
          <div className="legend-item" key={nt.name} style={{ margin: 0 }}>
            <span className="dot" style={{ background: nt.color, color: nt.color }} />
            {nt.name} {nt.sign > 0 ? "(+)" : "(−)"}
          </div>
        ))}
      </div>
    </div>
  );
}
