"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useNeuro } from "@/components/store";
import ControlPanel from "@/components/ControlPanel";
import ExperimentsPanel from "@/components/ExperimentsPanel";
import StatsPanel from "@/components/StatsPanel";
import Legend from "@/components/Legend";
import VitalsPanel from "@/components/VitalsPanel";
import LearningPanel from "@/components/LearningPanel";

// El Canvas usa WebGL: solo en cliente.
const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function Page() {
  const engine = useNeuro((s) => s.engine);
  const building = useNeuro((s) => s.building);
  const build = useNeuro((s) => s.build);
  const panelsHidden = useNeuro((s) => s.panelsHidden);
  const togglePanels = useNeuro((s) => s.togglePanels);

  useEffect(() => {
    if (!engine) build();
  }, [engine, build]);

  // Atajo: tecla H para ocultar/mostrar todos los paneles.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "h" || e.key === "H") togglePanels();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePanels]);

  return (
    <>
      <div className="canvas-wrap">{engine && <Scene />}</div>

      <button
        className="ui-toggle"
        onClick={togglePanels}
        title="Ocultar / mostrar paneles (H)"
      >
        {panelsHidden ? "▤ Mostrar paneles" : "▢ Ocultar paneles (H)"}
      </button>

      {!panelsHidden && (
        <>
          {/* Columna izquierda: control + leyenda. Centro y base quedan libres
              para ver al organismo moverse por el mundo. */}
          <div className="col col-left">
            <ControlPanel />
            <ExperimentsPanel />
            <Legend />
          </div>
          {/* Columna derecha: red, cuerpo y mente. */}
          <div className="col col-right">
            <StatsPanel />
            <VitalsPanel />
            <LearningPanel />
          </div>
        </>
      )}

      {!engine && <div className="building">Construyendo el cerebro…</div>}
      {building && <div className="building">Reconstruyendo la red neuronal…</div>}
    </>
  );
}
