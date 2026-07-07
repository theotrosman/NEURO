"use client";

import { create } from "zustand";
import { SimulationEngine, EngineStats } from "../lib/sim/SimulationEngine";
import { DEFAULT_DENSITY, DEFAULT_GAIN, DEFAULT_NOISE } from "../lib/sim/constants";

export type ColorMode = "type" | "region" | "activity";

interface BuildOptions {
  seed: number;
  density: number;
  gain: number;
  noise: number;
}

interface NeuroState {
  engine: SimulationEngine | null;
  buildVersion: number;
  building: boolean;

  // Parametros de construccion.
  seed: number;
  density: number;
  gain: number;
  noise: number;

  // Simulacion.
  running: boolean;
  speed: number; // pasos de simulacion por fotograma

  // Visualizacion.
  colorMode: ColorMode;
  showNeurons: boolean;
  showTracts: boolean;
  showPulses: boolean;
  showBody: boolean;
  showWorld: boolean;

  // Interaccion.
  selected: number | null;
  stats: EngineStats;

  // Acciones.
  build: () => void;
  rebuild: (opts?: Partial<BuildOptions>) => void;
  togglePlay: () => void;
  setSpeed: (v: number) => void;
  setColorMode: (m: ColorMode) => void;
  toggle: (
    key: "showNeurons" | "showTracts" | "showPulses" | "showBody" | "showWorld"
  ) => void;
  setParam: (key: "density" | "gain" | "noise" | "seed", v: number) => void;
  stimulate: (region: string, current?: number) => void;
  feed: () => void;
  giveWater: () => void;
  toggleSleep: () => void;
  setSelected: (id: number | null) => void;
  setStats: (s: EngineStats) => void;
}

export const useNeuro = create<NeuroState>((set, get) => ({
  engine: null,
  buildVersion: 0,
  building: false,

  seed: 20260706,
  density: DEFAULT_DENSITY,
  gain: DEFAULT_GAIN,
  noise: DEFAULT_NOISE,

  running: true,
  speed: 4,

  colorMode: "type",
  showNeurons: true,
  showTracts: true,
  showPulses: true,
  showBody: true,
  showWorld: true,

  selected: null,
  stats: { neurons: 0, synapses: 0, timeMs: 0, firingHz: 0, activePulses: 0 },

  build: () => {
    const { seed, density, gain, noise } = get();
    const engine = new SimulationEngine({ seed, density, gain, noiseStd: noise });
    // Acceso de depuracion desde consola: window.__neuro.update(4), etc.
    if (typeof window !== "undefined") (window as unknown as { __neuro: unknown }).__neuro = engine;
    set((s) => ({ engine, buildVersion: s.buildVersion + 1, selected: null }));
  },

  rebuild: (opts) => {
    set({ building: true });
    // Aplica nuevos parametros si vienen.
    if (opts) set(opts as Partial<NeuroState>);
    const { seed, density, gain, noise } = get();
    // setTimeout para permitir que la UI muestre el estado "building".
    setTimeout(() => {
      const engine = new SimulationEngine({ seed, density, gain, noiseStd: noise });
      if (typeof window !== "undefined") (window as unknown as { __neuro: unknown }).__neuro = engine;
      set((s) => ({
        engine,
        buildVersion: s.buildVersion + 1,
        selected: null,
        building: false,
      }));
    }, 20);
  },

  togglePlay: () => set((s) => ({ running: !s.running })),
  setSpeed: (v) => set({ speed: v }),
  setColorMode: (m) => set({ colorMode: m }),
  toggle: (key) => set((s) => ({ [key]: !s[key] } as Partial<NeuroState>)),
  setParam: (key, v) => set({ [key]: v } as Partial<NeuroState>),

  stimulate: (region, current = 45) => {
    get().engine?.stimulateRegion(region, current);
  },

  feed: () => get().engine?.feed(),
  giveWater: () => get().engine?.giveWater(),
  toggleSleep: () => get().engine?.toggleSleep(),

  setSelected: (id) => set({ selected: id }),
  setStats: (s) => set({ stats: s }),
}));
