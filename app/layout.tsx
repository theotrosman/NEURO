import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NEURO · Cerebro humano simulado en 3D",
  description:
    "Simulacion biologicamente plausible de neuronas humanas (modelo de Izhikevich) con conectoma verosimil, encarnada en un cuerpo 3D que usa esas conexiones.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div id="app">{children}</div>
      </body>
    </html>
  );
}
