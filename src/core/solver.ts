import { type PuzzleState, blockers } from "./puzzle";
/** A legal removal can never block another arrow. Greedy topological elimination
 * is therefore complete. Branching search is unnecessary for these monotone rules.
 * Dependencies come from the same blockers() used by the live game. O(n²) graph build. */
export function solve(initial: PuzzleState) {
  const dependencies = new Map(
    initial.map((a) => [
      a.id,
      new Set(blockers(initial, a.id).map((b) => b.id)),
    ]),
  );
  const dependents = new Map(initial.map((a) => [a.id, [] as string[]]));
  for (const [id, deps] of dependencies)
    for (const dep of deps) dependents.get(dep)!.push(id);
  const ready = initial
      .filter((a) => !dependencies.get(a.id)!.size)
      .map((a) => a.id),
    startMoves = [...ready],
    solution: string[] = [],
    widths: number[] = [];
  while (ready.length) {
    widths.push(ready.length);
    const id = ready.shift()!;
    solution.push(id);
    for (const next of dependents.get(id)!) {
      const deps = dependencies.get(next)!;
      deps.delete(id);
      if (!deps.size) ready.push(next);
    }
  }
  const removed = new Set(solution),
    remaining = initial.filter((a) => !removed.has(a.id)).map((a) => a.id);
  return {
    solvable: remaining.length === 0,
    solution,
    steps: remaining.length === 0 ? solution.length : null,
    startMoves,
    remaining,
    averageChoices:
      widths.reduce((a, b) => a + b, 0) / Math.max(1, widths.length),
  };
}
export function analyze(state: PuzzleState) {
  const result = solve(state),
    depth = new Map<string, number>();
  for (const id of result.solution)
    depth.set(
      id,
      1 + Math.max(0, ...blockers(state, id).map((a) => depth.get(a.id) ?? 0)),
    );
  const dependencyDepth = Math.max(0, ...depth.values());
  const occlusion =
    state.reduce(
      (sum, a) =>
        sum +
        state.filter(
          (b) =>
            b.id !== a.id &&
            ((a.x === b.x && a.y === b.y) ||
              (a.x === b.x && a.z === b.z) ||
              (a.y === b.y && a.z === b.z)),
        ).length,
      0,
    ) / Math.max(1, state.length);
  const score = Math.round(
    state.length * 0.6 +
      dependencyDepth * 3 +
      occlusion * 2 -
      result.startMoves.length * 0.3,
  );
  return { ...result, dependencyDepth, occlusion, score };
}
