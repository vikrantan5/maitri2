// Web-Audio-only alarm so we don't ship a binary file.
// Plays a short, attention-grabbing two-tone siren.
let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

export function playAlarm() {
  if (typeof window === "undefined") return;
  // Throttle to once every 2s so a burst of new cases doesn't overwhelm the user.
  const now = Date.now();
  if (now - lastPlayedAt < 2000) return;
  lastPlayedAt = now;
  try {
    if (!ctx) {
      const C: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!C) return;
      ctx = new C();
    }
    const c = ctx;
    if (c.state === "suspended") c.resume().catch(() => {});
    const start = c.currentTime;
    // Two siren sweeps
    for (let i = 0; i < 2; i++) {
      const t0 = start + i * 0.55;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, t0);
      osc.frequency.linearRampToValueAtTime(440, t0 + 0.45);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.04);
      gain.gain.linearRampToValueAtTime(0, t0 + 0.5);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    }
  } catch {
    /* ignore */
  }
}

// Some browsers block audio until first user gesture. Call this once on first click.
export function unlockAudioOnFirstGesture() {
  if (typeof window === "undefined") return;
  const handler = () => {
    try {
      const C: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!ctx && C) ctx = new C();
      ctx?.resume().catch(() => {});
    } catch {}
    window.removeEventListener("click", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("click", handler, { once: true });
  window.addEventListener("keydown", handler, { once: true });
}
