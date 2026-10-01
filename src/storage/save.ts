export interface Save {
  version: 1;
  unlocked: number;
  current: number;
  results: Record<string, { stars: number; mistakes: number; hints: number }>;
  sound: boolean;
  mode: "zen" | "challenge";
}
export const freshSave = (): Save => ({
  version: 1,
  unlocked: 1,
  current: 1,
  results: {},
  sound: false,
  mode: "zen",
});
export function decodeSave(text: string | null): Save {
  try {
    const s = JSON.parse(text ?? "null");
    if (!s || s.version !== 1) return freshSave();
    const clean = freshSave();
    clean.unlocked = Number.isInteger(s.unlocked)
      ? Math.max(1, Math.min(100, s.unlocked))
      : 1;
    clean.current = Number.isInteger(s.current)
      ? Math.max(1, Math.min(clean.unlocked, s.current))
      : 1;
    clean.sound = s.sound === true;
    clean.mode = s.mode === "challenge" ? "challenge" : "zen";
    if (s.results && typeof s.results === "object")
      for (const [id, v] of Object.entries(s.results)) {
        const r = v as Save["results"][string];
        if (
          /^\d+$/.test(id) &&
          Number(id) >= 1 &&
          Number(id) <= 100 &&
          r &&
          Number.isInteger(r.stars) &&
          r.stars >= 1 &&
          r.stars <= 3 &&
          Number.isInteger(r.mistakes) &&
          r.mistakes >= 0 &&
          Number.isInteger(r.hints) &&
          r.hints >= 0
        )
          clean.results[id] = r;
      }
    return clean;
  } catch {
    return freshSave();
  }
}
export class SaveManager {
  data: Save;
  available = true;
  constructor() {
    try {
      this.data = decodeSave(localStorage.getItem("vector-save-v1"));
    } catch {
      this.available = false;
      this.data = freshSave();
    }
  }
  persist() {
    try {
      localStorage.setItem("vector-save-v1", JSON.stringify(this.data));
    } catch {
      this.available = false;
    }
  }
  complete(id: number, mistakes: number, hints: number, total: number) {
    const stars = mistakes === 0 && hints === 0 ? 3 : mistakes <= 3 ? 2 : 1;
    const old = this.data.results[id];
    if (
      !old ||
      stars > old.stars ||
      (stars === old.stars && mistakes < old.mistakes)
    )
      this.data.results[id] = { stars, mistakes, hints };
    this.data.unlocked = Math.min(total, Math.max(this.data.unlocked, id + 1));
    this.persist();
    return stars;
  }
  reset() {
    this.data = freshSave();
    this.persist();
  }
}
