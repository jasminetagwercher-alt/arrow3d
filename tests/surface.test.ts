import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  faces,
  headings,
  step,
  key,
  parse,
  available,
  blockers,
  remove,
  solve,
  type Face,
  type SurfaceArrow,
} from "../src/surface/core";
import { generateSurface } from "../src/surface/generator";
const levels = JSON.parse(
  readFileSync("public/levels/surface.json", "utf8"),
).map(parse);
test("surface: every directed edge has an inverse on every face", () => {
  const size = 6;
  for (const face of Object.keys(faces) as Face[])
    for (let u = 0; u < size; u++)
      for (let v = 0; v < size; v++)
        for (const h of headings) {
          const cell = { face, u, v },
            next = step(cell, h, size);
          assert.ok(
            next.cell.u >= 0 &&
              next.cell.u < size &&
              next.cell.v >= 0 &&
              next.cell.v < size,
          );
          assert.ok(
            headings.some(
              (back) => key(step(next.cell, back, size).cell) === key(cell),
            ),
          );
        }
});
test("surface: a different path body blocks the head ray, even when its head is elsewhere", () => {
  const a: SurfaceArrow = {
    id: "a",
    heading: "right",
    path: [
      { face: "front", u: 0, v: 1 },
      { face: "front", u: 1, v: 1 },
    ],
  };
  const b: SurfaceArrow = {
    id: "b",
    heading: "up",
    path: [
      { face: "front", u: 3, v: 1 },
      { face: "front", u: 3, v: 2 },
    ],
  };
  assert.deepEqual(blockers([a, b], "a", 6), ["b"]);
  assert.deepEqual(available([a, b], 6), ["b"]);
  assert.throws(() => remove([a, b], "a", 6));
  assert.deepEqual(available(remove([a, b], "b", 6), 6), ["a"]);
  assert.equal(solve([a, b], 6).solvable, true);
});
test("surface: cyclic facing arrows are unsolvable", () => {
  const state: SurfaceArrow[] = [
    {
      id: "a",
      heading: "right",
      path: [
        { face: "front", u: 0, v: 0 },
        { face: "front", u: 1, v: 0 },
      ],
    },
    {
      id: "b",
      heading: "left",
      path: [
        { face: "front", u: 4, v: 0 },
        { face: "front", u: 3, v: 0 },
      ],
    },
  ];
  assert.equal(solve(state, 6).solvable, false);
});
test("surface: validates continuity, unique cells, head orientation and self-blocking", () => {
  const l = levels[0];
  assert.throws(() =>
    parse({ ...l, arrows: [l.arrows[0], { ...l.arrows[0], id: "duplicate" }] }),
  );
  assert.throws(() =>
    parse({
      ...l,
      arrows: [
        {
          ...l.arrows[0],
          path: [
            { face: "front", u: 0, v: 0 },
            { face: "front", u: 4, v: 4 },
          ],
        },
      ],
    }),
  );
  assert.throws(() => parse({ ...l, size: 2 }));
  assert.throws(() =>
    parse({ ...l, arrows: [{ ...l.arrows[0], heading: "toString" }] }),
  );
});
test("surface: all five prototypes are long, folded, non-overlapping and fully solvable", () => {
  assert.equal(levels.length, 5);
  for (const l of levels) {
    const r = solve(l.arrows, l.size);
    assert.equal(r.solvable, true);
    let state = l.arrows;
    for (const id of r.solution) state = remove(state, id, l.size);
    assert.equal(state.length, 0);
    assert.ok(l.arrows.every((a) => a.path.length >= 7));
    assert.ok(
      l.arrows.some((a) => new Set(a.path.map((c) => c.face)).size >= 2),
    );
    assert.ok(available(l.arrows, l.size).length < l.arrows.length);
  }
});
test("surface: reverse construction is deterministic and replays in reverse insertion order", () => {
  const l = generateSurface(41, 6, 12);
  assert.deepEqual(l, generateSurface(41, 6, 12));
  let state = l.arrows;
  for (const a of [...state].reverse()) state = remove(state, a.id, l.size);
  assert.equal(state.length, 0);
});
