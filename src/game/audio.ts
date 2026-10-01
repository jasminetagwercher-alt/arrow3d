export class AudioEngine {
  enabled = false;
  private context?: AudioContext;
  play(kind: "move" | "blocked" | "win" | "ui") {
    if (!this.enabled) return;
    try {
      const c = (this.context ??= new AudioContext());
      void c.resume();
      const notes =
        kind === "win"
          ? [523, 659, 784]
          : kind === "move"
            ? [580, 760]
            : kind === "blocked"
              ? [150]
              : [400];
      notes.forEach((frequency, i) => {
        const osc = c.createOscillator(),
          gain = c.createGain(),
          t = c.currentTime + i * 0.075;
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.055, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.19);
      });
    } catch {
      /* Audio is optional. */
    }
  }
}
