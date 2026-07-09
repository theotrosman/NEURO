"use client";

import { ReactNode, useState } from "react";

// Marco de panel plegable reutilizable. Cada panel del HUD vive dentro de una
// columna lateral y puede colapsarse a su encabezado para despejar la vista.
export default function Panel({
  title,
  children,
  right,
  defaultCollapsed = false,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  return (
    <div className="panel">
      <button
        className="panel-head"
        onClick={() => setOpen((v) => !v)}
        title={open ? "Colapsar" : "Expandir"}
      >
        <span className="panel-title">{title}</span>
        {right}
        <span className={`chev ${open ? "open" : ""}`}>▸</span>
      </button>
      {open && <div className="panel-body">{children}</div>}
    </div>
  );
}
