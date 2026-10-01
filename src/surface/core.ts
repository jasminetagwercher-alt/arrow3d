/** A discrete, closed cube surface. Paths run tail -> head. No renderer dependency. */
export type Vec = [number, number, number];
export const faces = {
  front: { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], label: "Vorne" },
  right: { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], label: "Rechts" },
  back: { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], label: "Hinten" },
  left: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], label: "Links" },
  top: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], label: "Oben" },
  bottom: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], label: "Unten" },
} as const;
export type Face = keyof typeof faces;
export type Heading = "right" | "up" | "left" | "down";
export const headings: Heading[] = ["right", "up", "left", "down"];
export const delta: Record<Heading, [number, number]> = {
  right: [1, 0],
  up: [0, 1],
  left: [-1, 0],
  down: [0, -1],
};
export interface Cell {
  face: Face;
  u: number;
  v: number;
}
export interface SurfaceArrow {
  id: string;
  path: Cell[];
  heading: Heading;
}
export interface SurfaceLevel {
  version: 2;
  id: number;
  name: string;
  size: number;
  hint: string;
  arrows: SurfaceArrow[];
}
export const key = (c: Cell) => `${c.face}:${c.u}:${c.v}`;
export const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, v, i) => sum + v * b[i], 0);
export function position(c: Cell, size: number): Vec {
  const f = faces[c.face];
  return f.n.map(
    (n, i) =>
      n * size + f.u[i] * (2 * c.u + 1 - size) + f.v[i] * (2 * c.v + 1 - size),
  ) as Vec;
}
export function direction(face: Face, heading: Heading): Vec {
  const f = faces[face],
    d = delta[heading];
  return f.u.map((v, i) => v * d[0] + f.v[i] * d[1]) as Vec;
}
/** Continue a step across an edge, transporting its heading into the new face. */
export function step(
  c: Cell,
  heading: Heading,
  size: number,
): { cell: Cell; heading: Heading } {
  const d = delta[heading],
    u = c.u + d[0],
    v = c.v + d[1];
  if (u >= 0 && v >= 0 && u < size && v < size)
    return { cell: { face: c.face, u, v }, heading };
  const old = faces[c.face],
    n = direction(c.face, heading),
    next = (Object.keys(faces) as Face[]).find(
      (face) => dot(faces[face].n, n) === 1,
    )!;
  const p = position(c, size).map((x, i) => x + n[i] - old.n[i]),
    f = faces[next];
  const transported = headings.find(
    (h) => dot(direction(next, h), old.n) === -1,
  )!;
  return {
    cell: {
      face: next,
      u: (dot(p, f.u) + size - 1) / 2,
      v: (dot(p, f.v) + size - 1) / 2,
    },
    heading: transported,
  };
}
export function forwardCells(a: SurfaceArrow, size: number): Cell[] {
  const head = a.path.at(-1)!,
    d = delta[a.heading],
    cells: Cell[] = [];
  // The head leaves tangentially at the next edge. It does not orbit the cube.
  for (
    let u = head.u + d[0], v = head.v + d[1];
    u >= 0 && u < size && v >= 0 && v < size;
    u += d[0], v += d[1]
  )
    cells.push({ face: head.face, u, v });
  return cells;
}
export function blockers(
  state: readonly SurfaceArrow[],
  id: string,
  size: number,
): string[] {
  const a = state.find((a) => a.id === id);
  if (!a) return [];
  const ray = new Set(forwardCells(a, size).map(key));
  return state
    .filter((b) => b.id !== id && b.path.some((c) => ray.has(key(c))))
    .map((b) => b.id);
}
export const available = (state: readonly SurfaceArrow[], size: number) =>
  state.filter((a) => !blockers(state, a.id, size).length).map((a) => a.id);
export function remove(
  state: readonly SurfaceArrow[],
  id: string,
  size: number,
): SurfaceArrow[] {
  if (!state.some((a) => a.id === id) || blockers(state, id, size).length)
    throw new Error("Diese Bahn ist blockiert.");
  return state.filter((a) => a.id !== id);
}
export function solve(state: readonly SurfaceArrow[], size: number) {
  let remaining = [...state];
  const solution: string[] = [];
  while (remaining.length) {
    const id = available(remaining, size)[0];
    if (!id) break;
    solution.push(id);
    remaining = remove(remaining, id, size);
  }
  return {
    solvable: !remaining.length,
    solution,
    remaining: remaining.map((a) => a.id),
  };
}
export function parse(raw: unknown): SurfaceLevel {
  if (!raw || typeof raw !== "object")
    throw new Error("Level muss ein Objekt sein.");
  const l = raw as SurfaceLevel;
  if (
    l.version !== 2 ||
    !Number.isInteger(l.id) ||
    l.id < 1 ||
    typeof l.name !== "string" ||
    !l.name.length ||
    l.name.length > 80 ||
    !Number.isInteger(l.size) ||
    l.size < 3 ||
    l.size > 16 ||
    !Array.isArray(l.arrows) ||
    !l.arrows.length ||
    l.arrows.length > 150
  )
    throw new Error("Ungültiger Oberflächen-Level.");
  const ids = new Set<string>(),
    occupied = new Set<string>();
  const arrows = l.arrows.map((a) => {
    if (
      !a ||
      typeof a.id !== "string" ||
      !a.id ||
      a.id.length > 60 ||
      ids.has(a.id) ||
      !headings.includes(a.heading) ||
      !Array.isArray(a.path) ||
      a.path.length < 2 ||
      a.path.length > 6 * l.size * l.size
    )
      throw new Error("Ungültige Pfeilbahn.");
    ids.add(a.id);
    const path = a.path.map((c) => {
      if (
        !c ||
        !Object.hasOwn(faces, c.face) ||
        ![c.u, c.v].every((v) => Number.isInteger(v) && v >= 0 && v < l.size)
      )
        throw new Error("Ungültige Oberflächenzelle.");
      const k = key(c);
      if (occupied.has(k))
        throw new Error("Pfeilbahnen dürfen sich nicht überlagern.");
      occupied.add(k);
      return { face: c.face, u: c.u, v: c.v };
    });
    for (let i = 1; i < path.length; i++)
      if (
        !headings.some(
          (h) => key(step(path[i - 1], h, l.size).cell) === key(path[i]),
        )
      )
        throw new Error("Die Pfeilbahn ist unterbrochen.");
    const last = path.at(-1)!,
      prev = path.at(-2)!;
    const incoming = headings
      .map((h) => step(prev, h, l.size))
      .find((s) => key(s.cell) === key(last))!;
    if (incoming.heading !== a.heading)
      throw new Error("Die Spitze muss die letzte Strecke fortsetzen.");
    const ray = new Set(forwardCells({ ...a, path }, l.size).map(key));
    if (path.slice(0, -1).some((c) => ray.has(key(c))))
      throw new Error("Die Pfeilbahn blockiert ihre eigene Austrittslinie.");
    return { id: a.id, path, heading: a.heading };
  });
  return {
    version: 2,
    id: l.id,
    name: l.name,
    size: l.size,
    hint:
      typeof l.hint === "string"
        ? l.hint
        : "Folge den Pfeilspitzen bis zum Rand.",
    arrows,
  };
}
