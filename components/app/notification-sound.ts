"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * Notification sounds, synthesized in the browser (no audio files) — ported from
 * the VEGAS staff-alert engine. Browsers block audio until the user interacts,
 * so the first tap/keypress anywhere unlocks it and the bell shows the state
 * (green = live, red = blocked/off). ACTION alerts use a firmer "bell"; INFO a
 * softer "chime".
 */

export const SOUNDS: Record<string, string> = {
  bell: "Bell",
  chime: "Chime",
  marimba: "Marimba",
  alarm: "Alarm (loud)",
};

let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      ctx.onstatechange = emit;
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Try to allow sound — must run inside a tap / click / key press. */
export async function unlockAudio(): Promise<boolean> {
  const c = context();
  if (!c) return false;
  try {
    if (c.state !== "running") await c.resume();
  } catch {
    /* still blocked */
  }
  emit();
  return c.state === "running";
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Whether this screen may play sound right now (green vs red bell dot). */
export function useAudioReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => ctx?.state === "running",
    () => false,
  );
}

type Note = { f: number; at: number; len: number; type?: OscillatorType; gain?: number };
const TUNES: Record<string, Note[]> = {
  bell: [
    { f: 1046, at: 0, len: 1.3 },
    { f: 2093, at: 0, len: 0.8, gain: 0.35 },
    { f: 1046, at: 0.55, len: 1.3 },
    { f: 2093, at: 0.55, len: 0.8, gain: 0.35 },
  ],
  chime: [
    { f: 880, at: 0, len: 0.55 },
    { f: 1318, at: 0.18, len: 0.8 },
  ],
  marimba: [
    { f: 523, at: 0, len: 0.35, type: "triangle" },
    { f: 659, at: 0.12, len: 0.35, type: "triangle" },
    { f: 784, at: 0.24, len: 0.35, type: "triangle" },
    { f: 1046, at: 0.36, len: 0.6, type: "triangle" },
  ],
  alarm: [0, 0.22, 0.44, 0.9, 1.12, 1.34].map((at) => ({
    f: 988,
    at,
    len: 0.16,
    type: "square" as const,
    gain: 0.45,
  })),
};

const tuneLength = (name: string) => Math.max(...(TUNES[name] ?? TUNES.chime).map((n) => n.at + n.len));

/**
 * Play a sound at a volume from 0–100. `times`: ring it again straight after
 * (alerts ring twice). A limiter keeps it loud without crackling.
 */
export function playSound(name: string, volume: number, times = 1): void {
  const c = context();
  if (!c || c.state !== "running" || volume <= 0) return;
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 4;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  limiter.connect(c.destination);
  const master = c.createGain();
  master.gain.value = Math.min(1, volume / 100) * 2.2;
  master.connect(limiter);
  const gap = tuneLength(name) + 0.25;
  for (let k = 0; k < Math.max(1, Math.min(3, times)); k++) ring(c, master, name, c.currentTime + 0.02 + k * gap);
}

function ring(c: AudioContext, master: GainNode, name: string, t0: number): void {
  for (const n of TUNES[name] ?? TUNES.chime) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = n.type ?? "sine";
    o.frequency.value = n.f;
    const peak = n.gain ?? 0.8;
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
    o.connect(g).connect(master);
    o.start(t0 + n.at);
    o.stop(t0 + n.at + n.len + 0.05);
  }
}

/** Browser pop-up notifications (also when the tab is in the background). */
export function useNotifyPermission() {
  const read = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => {
    const t = setTimeout(() => setPerm(read()), 0);
    return () => clearTimeout(t);
  }, []);
  const ask = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    try {
      setPerm(await Notification.requestPermission());
    } catch {
      /* ignored */
    }
  }, []);
  return { perm, ask };
}
