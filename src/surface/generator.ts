import { random } from "../levels/generator";
import {
  faces,
  headings,
  delta,
  key,
  step,
  forwardCells,
  blockers,
  parse,
  type Face,
  type Heading,
  type Cell,
  type SurfaceArrow,
  type SurfaceLevel,
} from "./core";
const opposite: Record<Heading, Heading> = {
  right: "left",
  left: "right",
  up: "down",
  down: "up",
};
/** Reverse insertion; new heads always have a free exit in the existing state. */
export function generateSurface(
  seed: number,
  size: number,
  count: number,
): SurfaceLevel {
  const rng = random(seed),
    cells: Cell[] = [];
  for (const face of Object.keys(faces) as Face[])
    for (let u = 0; u < size; u++)
      for (let v = 0; v < size; v++) cells.push({ face, u, v });
  const arrows: SurfaceArrow[] = [],
    occupied = new Set<string>();
  for (let index = 0; index < count; index++) {
    let best: SurfaceArrow | undefined,
      bestScore = -Infinity;
    for (let candidate = 0; candidate < 220; candidate++) {
      const head = cells[Math.floor(rng() * cells.length)];
      if (occupied.has(key(head))) continue;
      const heading = headings[Math.floor(rng() * 4)],
        back = step(head, opposite[heading], size);
      const forbidden = new Set(
        forwardCells({ id: "new", path: [head], heading }, size).map(key),
      );
      if (
        [...forbidden].some((k) => occupied.has(k)) ||
        occupied.has(key(back.cell)) ||
        forbidden.has(key(back.cell))
      )
        continue;
      const reverse = [head, back.cell],
        own = new Set(reverse.map(key));
      let travel = back.heading;
      const maxLength = 12 + Math.floor(rng() * 14);
      let turns = 0,
        crossings = head.face !== back.cell.face ? 1 : 0;
      while (reverse.length < maxLength) {
        const tail = reverse.at(-1)!;
        const options = headings
          .map((h) => ({ h, ...step(tail, h, size) }))
          .filter(
            (s) =>
              !occupied.has(key(s.cell)) &&
              !own.has(key(s.cell)) &&
              !forbidden.has(key(s.cell)),
          );
        if (!options.length) break;
        options.sort((a, b) => Number(b.h !== travel) - Number(a.h !== travel));
        const choice = options[Math.floor(rng() * options.length)];
        if (choice.h !== travel) turns++;
        if (choice.cell.face !== tail.face) crossings++;
        travel = choice.heading;
        reverse.push(choice.cell);
        own.add(key(choice.cell));
      }
      if (reverse.length < 7 || turns < 2) continue;
      const a: SurfaceArrow = {
        id: `p${String(index + 1).padStart(2, "0")}`,
        path: [...reverse].reverse(),
        heading,
      };
      const blocked = arrows.filter(
        (b) => blockers([b, a], b.id, size).length,
      ).length;
      const score =
        reverse.length * 0.4 +
        turns * 0.45 +
        Math.min(crossings, 2) * 2.3 +
        blocked * 4 +
        rng() * 3;
      if (score > bestScore) {
        best = a;
        bestScore = score;
      }
    }
    if (!best) break;
    arrows.push(best);
    for (const c of best.path) occupied.add(key(c));
  }
  return parse({
    version: 2,
    id: 1,
    name: "Verschlungene Wege",
    size,
    hint: "Die Spitze zeigt den Ausgang. Erst wenn die Linie bis zur nächsten Kante frei ist, lässt sich die ganze Bahn herausziehen.",
    arrows,
  });
}
