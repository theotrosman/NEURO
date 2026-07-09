"use client";

import { create } from "zustand";
import {
  SimulationEngine,
  EngineStats,
  NeuromodState,
} from "../lib/sim/SimulationEngine";
import { DEFAULT_DENSITY, DEFAULT_GAIN, DEFAULT_NOISE } from "../lib/sim/constants";

export type ColorMode = "type" | "region" | "activity";

// Neuromoduladores preconfigurados ("drogas") para el laboratorio. Cada uno
// desplaza la quimica global de la red: excitabilidad, inhibicion, ruido y
// dopamina. Son caricaturas legibles de familias reales de psicoactivos.
export interface DrugPreset {
  key: string;
  label: string;
  desc: string;
  color: string;
  mod: NeuromodState;
}

export const DRUGS: DrugPreset[] = [
  {
    key: "dopamine",
    label: "Dopamina",
    desc: "Euforia y refuerzo: el centro de recompensa se enciende y el aprendizaje se dispara sin logro real.",
    color: "#ffd23c",
    mod: { excitability: 1.15, inhibition: 0.9, noise: 1, dopamine: 1 },
  },
  {
    key: "stimulant",
    label: "Estimulante",
    desc: "Anfetamina / cafeina: hiperexcitabilidad y ruido; toda la red se acelera.",
    color: "#ff6b4a",
    mod: { excitability: 1.6, inhibition: 0.8, noise: 1.5, dopamine: 0.4 },
  },
  {
    key: "depressant",
    label: "Depresor GABA",
    desc: "Alcohol / benzodiacepina: la inhibicion domina y la actividad se aletarga.",
    color: "#5f86ff",
    mod: { excitability: 0.7, inhibition: 1.9, noise: 0.8, dopamine: 0 },
  },
  {
    key: "psychedelic",
    label: "Psicodelico",
    desc: "Ruido masivo: disparos caoticos y percepcion desordenada (tipo alucinogeno).",
    color: "#c06bff",
    mod: { excitability: 1.25, inhibition: 0.85, noise: 3.2, dopamine: 0.2 },
  },
  {
    key: "anesthetic",
    label: "Anestesia",
    desc: "Inhibicion extrema y poca excitabilidad: la red casi se apaga.",
    color: "#5fd0c0",
    mod: { excitability: 0.4, inhibition: 2.6, noise: 0.5, dopamine: 0 },
  },
];

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

  // UI.
  panelsHidden: boolean;

  // Experimentos (laboratorio).
  lesions: Record<string, boolean>; // regiones apagadas
  drug: string | null; // neuromodulador activo (key de DRUGS)
  manualControl: boolean; // el usuario conduce el cuerpo

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
  togglePlasticity: () => void;
  togglePanels: () => void;
  // Experimentos.
  toggleLesion: (name: string) => void;
  healAll: () => void;
  applyDrug: (preset: DrugPreset) => void;
  clearDrugs: () => void;
  setManualControl: (on: boolean) => void;
  toggleManual: () => void;
  setManualDrive: (forward: number, turn: number) => void;
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

  panelsHidden: false,

  lesions: {},
  drug: null,
  manualControl: false,

  selected: null,
  stats: { neurons: 0, synapses: 0, timeMs: 0, firingHz: 0, activePulses: 0 },

  build: () => {
    const { seed, density, gain, noise } = get();
    const engine = new SimulationEngine({ seed, density, gain, noiseStd: noise });
    // Acceso de depuracion desde consola: window.__neuro.update(4), etc.
    if (typeof window !== "undefined") (window as unknown as { __neuro: unknown }).__neuro = engine;
    set((s) => ({
      engine,
      buildVersion: s.buildVersion + 1,
      selected: null,
      lesions: {},
      drug: null,
      manualControl: false,
    }));
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
        lesions: {},
        drug: null,
        manualControl: false,
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
  togglePlasticity: () => get().engine?.togglePlasticity(),
  togglePanels: () => set((s) => ({ panelsHidden: !s.panelsHidden })),

  // --- Experimentos ---
  toggleLesion: (name) => {
    const engine = get().engine;
    if (!engine) return;
    const on = engine.toggleLesion(name);
    set((s) => ({ lesions: { ...s.lesions, [name]: on } }));
  },
  healAll: () => {
    get().engine?.healAll();
    set({ lesions: {} });
  },
  applyDrug: (preset) => {
    const engine = get().engine;
    if (!engine) return;
    // Reaplicar la misma droga la retira (toggle): vuelve a estado sobrio.
    if (get().drug === preset.key) {
      engine.clearNeuromod();
      set({ drug: null });
      return;
    }
    engine.setNeuromod(preset.mod);
    set({ drug: preset.key });
  },
  clearDrugs: () => {
    get().engine?.clearNeuromod();
    set({ drug: null });
  },
  setManualControl: (on) => {
    get().engine?.setManualControl(on);
    set({ manualControl: on });
  },
  toggleManual: () => get().setManualControl(!get().manualControl),
  setManualDrive: (forward, turn) => get().engine?.setManualDrive(forward, turn),

  setSelected: (id) => set({ selected: id }),
  setStats: (s) => set({ stats: s }),
}));
