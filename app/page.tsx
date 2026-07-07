"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useNeuro } from "@/components/store";
import ControlPanel from "@/components/ControlPanel";
import StatsPanel from "@/components/StatsPanel";
import Legend from "@/components/Legend";

// El Canvas usa WebGL: solo en cliente.
const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function Page() {
  const engine = useNeuro((s) => s.engine);
  const building = useNeuro((s) => s.building);
  const build = useNeuro((s) => s.build);

  useEffect(() => {
    if (!engine) build();
  }, [engine, build]);

  return (
    <>
      <div className="canvas-wrap">{engine && <Scene />}</div>

      <ControlPanel />
      <StatsPanel />
      <Legend />

      {!engine && <div className="building">Construyendo el cerebro…</div>}
      {building && <div className="building">Reconstruyendo la red neuronal…</div>}
    </>
  );
}
