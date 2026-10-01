/** Grid occupancy, not rendered geometry, defines every rule. A move only removes occupancy. */
export const vectors = {
  POS_X: [1, 0, 0],
  NEG_X: [-1, 0, 0],
  POS_Y: [0, 1, 0],
  NEG_Y: [0, -1, 0],
  POS_Z: [0, 0, 1],
  NEG_Z: [0, 0, -1],
} as const;
export type Direction = keyof typeof vectors;
export interface Arrow {
  id: string;
  x: number;
  y: number;
  z: number;
  direction: Direction;
}
export interface Level {
  id: number;
  name: string;
  chapter: string;
  hint: string;
  arrows: Arrow[];
}
export type PuzzleState = readonly Arrow[];
export function blockers(state: PuzzleState, id: string): Arrow[] {
  const a = state.find((a) => a.id === id);
  if (!a) return [];
  const d = vectors[a.direction];
  return state.filter(
    (b) =>
      b.id !== id &&
      (["x", "y", "z"] as const).every((k, i) =>
        d[i] === 0 ? b[k] === a[k] : (b[k] - a[k]) * d[i] > 0,
      ),
  );
}
export function canArrowEscape(state: PuzzleState, id: string): boolean {
  return state.some((a) => a.id === id) && blockers(state, id).length === 0;
}
export function getAvailableMoves(state: PuzzleState): string[] {
  return state.filter((a) => canArrowEscape(state, a.id)).map((a) => a.id);
}
export function applyMove(state: PuzzleState, id: string): Arrow[] {
  if (!canArrowEscape(state, id))
    throw new Error("Dieser Pfeil ist blockiert.");
  return state.filter((a) => a.id !== id);
}
export function isSolved(state: PuzzleState): boolean {
  return state.length === 0;
}
export function parseLevel(raw: unknown): Level {
  if (!raw || typeof raw !== "object")
    throw new Error("Level muss ein JSON-Objekt sein.");
  const l = raw as Level;
  if (
    !Number.isInteger(l.id) ||
    l.id < 1 ||
    typeof l.name !== "string" ||
    l.name.length > 80 ||
    !Array.isArray(l.arrows) ||
    l.arrows.length < 1 ||
    l.arrows.length > 300
  )
    throw new Error("Level: ID, Name oder Pfeilanzahl ungültig (1–300).");
  const ids = new Set<string>(),
    cells = new Set<string>();
  const arrows = l.arrows.map((a) => {
    if (
      !a ||
      typeof a.id !== "string" ||
      !a.id.length ||
      a.id.length > 80 ||
      ids.has(a.id) ||
      !Object.hasOwn(vectors, a.direction) ||
      ![a.x, a.y, a.z].every((n) => Number.isInteger(n) && Math.abs(n) <= 20)
    )
      throw new Error(
        "Pfeil: ID, Richtung oder Rasterposition ungültig (−20 bis 20).",
      );
    const key = [a.x, a.y, a.z].join(",");
    if (cells.has(key))
      throw new Error("Zwei Pfeile belegen dieselbe Rasterposition.");
    ids.add(a.id);
    cells.add(key);
    return { id: a.id, x: a.x, y: a.y, z: a.z, direction: a.direction };
  });
  return {
    id: l.id,
    name: l.name,
    chapter: typeof l.chapter === "string" ? l.chapter : "Werkstatt",
    hint:
      typeof l.hint === "string"
        ? l.hint
        : "Drehe das Puzzle und suche einen freien Weg.",
    arrows,
  };
}
