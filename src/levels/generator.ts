import {
  canArrowEscape,
  vectors,
  type Arrow,
  type Direction,
  type Level,
} from "../core/puzzle";
export interface GeneratorOptions {
  seed: number;
  count: number;
  dimensions: [number, number, number];
  shape: "block" | "tower" | "shell" | "cross" | "ring";
  density?: number;
  directions?: Direction[];
}
export function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Reverse construction: a new arrow must escape the existing arrangement.
 * Removing in reverse insertion order is always a known solution. */
export function generate(options: GeneratorOptions): Level {
  const { seed, count, dimensions, shape } = options;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 300 ||
    dimensions.some((n) => !Number.isInteger(n) || n < 1 || n > 15)
  )
    throw new Error("Ungültige Generatorgröße.");
  const rng = random(seed),
    dirs = options.directions ?? (Object.keys(vectors) as Direction[]);
  if (!dirs.length || dirs.some((d) => !Object.hasOwn(vectors, d)))
    throw new Error("Ungültige Richtungen.");
  const density = options.density ?? 1;
  if (density <= 0 || density > 1)
    throw new Error("Dichte muss zwischen 0 und 1 liegen.");
  const cells: { x: number; y: number; z: number }[] = [];
  for (let x = 0; x < dimensions[0]; x++)
    for (let y = 0; y < dimensions[1]; y++)
      for (let z = 0; z < dimensions[2]; z++) {
        const edgeX = x === 0 || x === dimensions[0] - 1,
          edgeY = y === 0 || y === dimensions[1] - 1,
          edgeZ = z === 0 || z === dimensions[2] - 1;
        if (shape === "shell" && !edgeX && !edgeY && !edgeZ) continue;
        if (shape === "ring" && !edgeX && !edgeZ) continue;
        if (
          shape === "cross" &&
          Math.abs(x - (dimensions[0] - 1) / 2) > 0.5 &&
          Math.abs(z - (dimensions[2] - 1) / 2) > 0.5
        )
          continue;
        cells.push({
          x: x - Math.floor(dimensions[0] / 2),
          y: y - Math.floor(dimensions[1] / 2),
          z: z - Math.floor(dimensions[2] / 2),
        });
      }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const arrows: Arrow[] = [];
  const target = Math.min(
    count,
    Math.max(1, Math.floor(cells.length * density)),
  );
  for (const cell of cells) {
    const a: Arrow = {
      ...cell,
      id: `a${String(arrows.length + 1).padStart(3, "0")}`,
      direction: dirs[0],
    };
    const allowed = dirs.filter((direction) =>
      canArrowEscape([...arrows, { ...a, direction }], a.id),
    );
    if (!allowed.length) continue;
    a.direction = allowed[Math.floor(rng() * allowed.length)];
    arrows.push(a);
    if (arrows.length === target) break;
  }
  if (arrows.length < target)
    throw new Error(
      "Zu wenig freie Plätze für diese Parameter. Wähle größere Dimensionen oder weniger Pfeile.",
    );
  return {
    id: 1,
    name: "Neue Perspektive",
    chapter: "WERKSTATT",
    hint: "Drehe das Puzzle und suche einen freien Weg.",
    arrows,
  };
}
