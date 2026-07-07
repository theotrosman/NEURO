"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useNeuro } from "./store";
import { NEURON_TYPES } from "../lib/neuron/NeuronTypes";
import { REGIONS } from "../lib/brain/regions";
import { NEUROTRANSMITTERS } from "../lib/neuron/Neurotransmitter";
import { color } from "../lib/utils/colors";

const NEURON_SCALE = 0.16;
const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

export default function BrainView() {
  const engine = useNeuro((s) => s.engine);
  const buildVersion = useNeuro((s) => s.buildVersion);
  const colorMode = useNeuro((s) => s.colorMode);
  const showNeurons = useNeuro((s) => s.showNeurons);
  const showTracts = useNeuro((s) => s.showTracts);
  const showPulses = useNeuro((s) => s.showPulses);
  const running = useNeuro((s) => s.running);
  const speed = useNeuro((s) => s.speed);
  const setSelected = useNeuro((s) => s.setSelected);
  const setStats = useNeuro((s) => s.setStats);

  const neuronsRef = useRef<THREE.InstancedMesh>(null);
  const pulsesRef = useRef<THREE.InstancedMesh>(null);
  const statTimer = useRef(0);

  // Colores base por neurona segun el modo (tipo/region). En modo "activity"
  // se calcula por fotograma.
  const baseColors = useMemo(() => {
    if (!engine) return new Float32Array(0);
    const neurons = engine.network.neurons;
    const arr = new Float32Array(neurons.length * 3);
    for (let i = 0; i < neurons.length; i++) {
      const n = neurons[i];
      let hex: string;
      if (colorMode === "region") hex = REGIONS[n.region].color;
      else if (colorMode === "type") hex = NEURON_TYPES[n.typeName].color;
      else hex = "#3a6bff";
      const c = color(hex);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [engine, buildVersion, colorMode]);

  // Geometria de los tractos (haces largos) como segmentos de linea.
  const tracts = useMemo(() => {
    if (!engine) return null;
    const net = engine.network;
    const ids = net.tractSynapses;
    const positions = new Float32Array(ids.length * 2 * 3);
    const colors = new Float32Array(ids.length * 2 * 3);
    for (let i = 0; i < ids.length; i++) {
      const syn = net.synapses[ids[i]];
      const a = net.neurons[syn.pre];
      const b = net.neurons[syn.post];
      const o = i * 6;
      positions[o] = a.x; positions[o + 1] = a.y; positions[o + 2] = a.z;
      positions[o + 3] = b.x; positions[o + 4] = b.y; positions[o + 5] = b.z;
      const c = color(NEUROTRANSMITTERS[syn.transmitter].color);
      for (let k = 0; k < 2; k++) {
        colors[o + k * 3] = c.r * 0.6;
        colors[o + k * 3 + 1] = c.g * 0.6;
        colors[o + k * 3 + 2] = c.b * 0.6;
      }
    }
    return { positions, colors, count: ids.length };
  }, [engine, buildVersion]);

  // Coloca las matrices de instancia de los somas una sola vez.
  useEffect(() => {
    const mesh = neuronsRef.current;
    if (!mesh || !engine) return;
    const neurons = engine.network.neurons;
    for (let i = 0; i < neurons.length; i++) {
      const n = neurons[i];
      dummy.position.set(n.x, n.y, n.z);
      const s = n.type.somaRadius * NEURON_SCALE;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tmpColor.setRGB(0.2, 0.3, 0.6));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [engine, buildVersion]);

  // Inicializa el buffer de color de los pulsos (oculto hasta que viajen).
  useEffect(() => {
    const pulses = pulsesRef.current;
    if (!pulses) return;
    for (let i = 0; i < 1400; i++) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      pulses.setMatrixAt(i, dummy.matrix);
      pulses.setColorAt(i, tmpColor.setRGB(1, 1, 1));
    }
    pulses.instanceMatrix.needsUpdate = true;
    if (pulses.instanceColor) pulses.instanceColor.needsUpdate = true;
  }, [engine, buildVersion, showPulses]);

  useFrame((_, delta) => {
    if (!engine) return;
    if (running) engine.update(speed);

    // --- Actualizar color/brillo de los somas ---
    const mesh = neuronsRef.current;
    if (mesh && mesh.instanceColor && showNeurons) {
      const arr = mesh.instanceColor.array as Float32Array;
      const neurons = engine.network.neurons;
      const activityMode = colorMode === "activity";
      for (let i = 0; i < neurons.length; i++) {
        const n = neurons[i];
        const a = n.activation();
        const glow = n.spikeGlow;
        if (activityMode) {
          // Frio (reposo) -> calido (activo).
          arr[i * 3] = 0.1 + a * 0.9 + glow * 0.4;
          arr[i * 3 + 1] = 0.15 + a * 0.35;
          arr[i * 3 + 2] = 0.5 - a * 0.4 + glow * 0.3;
        } else {
          const f = 0.14 + 0.86 * a;
          arr[i * 3] = Math.min(1, baseColors[i * 3] * f + glow);
          arr[i * 3 + 1] = Math.min(1, baseColors[i * 3 + 1] * f + glow);
          arr[i * 3 + 2] = Math.min(1, baseColors[i * 3 + 2] * f + glow);
        }
      }
      mesh.instanceColor.needsUpdate = true;
    }

    // --- Actualizar pulsos que viajan por los tractos ---
    const pulses = pulsesRef.current;
    if (pulses && showPulses) {
      const sf = engine.signals;
      const net = engine.network;
      const pc = pulses.instanceColor;
      for (let i = 0; i < sf.count; i++) {
        const p = sf.progress(i);
        if (p < 0) {
          dummy.position.set(0, -9999, 0);
          dummy.scale.setScalar(0.0001);
        } else {
          const syn = net.synapses[sf.synId[i]];
          const a = net.neurons[syn.pre];
          const b = net.neurons[syn.post];
          dummy.position.set(
            a.x + (b.x - a.x) * p,
            a.y + (b.y - a.y) * p,
            a.z + (b.z - a.z) * p
          );
          dummy.scale.setScalar(0.32);
          if (pc) {
            const c = color(NEUROTRANSMITTERS[syn.transmitter].color);
            (pc.array as Float32Array).set([c.r, c.g, c.b], i * 3);
          }
        }
        dummy.updateMatrix();
        pulses.setMatrixAt(i, dummy.matrix);
      }
      pulses.instanceMatrix.needsUpdate = true;
      if (pc) pc.needsUpdate = true;
    }

    // --- Publicar estadisticas ~5 veces por segundo ---
    statTimer.current += delta;
    if (statTimer.current > 0.2) {
      statTimer.current = 0;
      setStats(engine.stats());
    }
  });

  if (!engine) return null;
  const n = engine.network.size;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    e.stopPropagation();
    setSelected(e.instanceId);
    engine.stimulateNeuron(e.instanceId, 55);
  };

  return (
    <group>
      {showNeurons && (
        <instancedMesh
          key={`neurons-${buildVersion}`}
          ref={neuronsRef}
          args={[undefined as never, undefined as never, n]}
          onClick={onClick}
          frustumCulled={false}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      )}

      {showPulses && (
        <instancedMesh
          key={`pulses-${buildVersion}`}
          ref={pulsesRef}
          args={[undefined as never, undefined as never, 1400]}
          frustumCulled={false}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial toneMapped={false} blending={THREE.AdditiveBlending} />
        </instancedMesh>
      )}

      {showTracts && tracts && tracts.count > 0 && (
        <lineSegments key={`tracts-${buildVersion}`} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[tracts.positions, 3]}
            />
            <bufferAttribute attach="attributes-color" args={[tracts.colors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.16}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </lineSegments>
      )}
    </group>
  );
}
