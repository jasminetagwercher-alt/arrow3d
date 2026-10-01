import { writeFileSync } from "node:fs";
import { generateSurface } from "../src/surface/generator";
import { solve, available } from "../src/surface/core";
const specs = [
  { seed: 41, size: 6, count: 12, name: "Über Ecken" },
  { seed: 87, size: 7, count: 18, name: "Eng verbunden" },
  { seed: 123, size: 8, count: 24, name: "Sechs Seiten" },
  { seed: 412, size: 9, count: 30, name: "Verschlungene Wege" },
  { seed: 951, size: 10, count: 36, name: "Der ganze Würfel" },
];
const levels = specs.map((s, i) => {
  const l = generateSurface(s.seed, s.size, s.count);
  l.id = i + 1;
  l.name = s.name;
  if (!solve(l.arrows, l.size).solvable) throw new Error("Unlösbar");
  console.log(
    l.id,
    l.name,
    JSON.stringify({
      arrows: l.arrows.length,
      cells: l.arrows.reduce((n, a) => n + a.path.length, 0),
      startMoves: available(l.arrows, l.size).length,
      crossings: l.arrows.filter(
        (a) => new Set(a.path.map((c) => c.face)).size > 1,
      ).length,
    }),
  );
  return l;
});
writeFileSync(
  "public/levels/surface.json",
  JSON.stringify(levels, null, 2) + "\n",
);
