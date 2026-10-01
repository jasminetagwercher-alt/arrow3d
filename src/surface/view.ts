import * as T from "three";
import { SceneManager } from "../game/scene";
import {
  faces,
  position,
  direction,
  type SurfaceArrow,
  type SurfaceLevel,
  type Cell,
} from "./core";
interface Visual {
  group: T.Group;
  line: T.Mesh<T.TubeGeometry, T.MeshStandardMaterial>;
  tip: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  material: T.MeshStandardMaterial;
  points: T.Vector3[];
  lengths: number[];
  length: number;
  dir: T.Vector3;
  normal: T.Vector3;
  animation?: { kind: "fly" | "blocked"; start: number; done?: () => void };
}
/** Piecewise linear path parametrised by distance. Edges remain on the cube. */
class Polyline extends T.Curve<T.Vector3> {
  lengths: number[] = [0];
  total = 0;
  constructor(public points: T.Vector3[]) {
    super();
    for (let i = 1; i < points.length; i++) {
      this.total += points[i].distanceTo(points[i - 1]);
      this.lengths.push(this.total);
    }
  }
  getPoint(t: number, target = new T.Vector3()) {
    const d = T.MathUtils.clamp(t, 0, 1) * this.total;
    let i = 1;
    while (i < this.points.length - 1 && this.lengths[i] < d) i++;
    return target
      .copy(this.points[i - 1])
      .lerp(
        this.points[i],
        (d - this.lengths[i - 1]) /
          Math.max(1e-9, this.lengths[i] - this.lengths[i - 1]),
      );
  }
}
export class SurfaceView {
  base: SceneManager;
  visuals = new Map<string, Visual>();
  body: T.Mesh;
  private edges: T.LineSegments;
  private picks: T.Object3D[] = [];
  private ray = new T.Raycaster();
  private pointer = new T.Vector2();
  private gestures = new Map<
    number,
    { x: number; y: number; moved: boolean }
  >();
  private multi = false;
  private frame = 0;
  private disposed = false;
  private size = 6;
  private hovered?: string;
  private flying = false;
  onPick: (id: string) => void = () => {};
  onHover: (id?: string) => void = () => {};
  constructor(host: HTMLElement) {
    this.base = new SceneManager(host);
    this.base.controls.enableDamping = false;
    for (const child of this.base.scene.children)
      if (child instanceof T.Mesh && child.geometry instanceof T.PlaneGeometry)
        child.position.y = -3.4;
    this.body = new T.Mesh(
      new T.BoxGeometry(6, 6, 6),
      new T.MeshStandardMaterial({
        color: "#fffefa",
        roughness: 0.9,
        metalness: 0,
      }),
    );
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.base.scene.add(this.body);
    this.edges = new T.LineSegments(
      new T.EdgesGeometry(this.body.geometry),
      new T.LineBasicMaterial({
        color: "#c1ccc5",
        transparent: true,
        opacity: 0.38,
      }),
    );
    this.base.scene.add(this.edges);
    this.base.renderer.domElement.setAttribute(
      "aria-label",
      "Würfel mit langen Pfeilbahnen auf sechs Flächen. Ziehen zum Drehen, Pfeilbahn antippen zum Herausziehen.",
    );
    const canvas = this.base.renderer.domElement;
    canvas.addEventListener("pointerdown", this.down);
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerup", this.up);
    canvas.addEventListener("pointercancel", this.cancel);
    canvas.addEventListener("pointerleave", this.leave);
    this.reset();
    this.tick();
  }
  get camera() {
    return this.base.camera;
  }
  get renderer() {
    return this.base.renderer;
  }
  private hit(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((x - r.left) / r.width) * 2 - 1,
      (-(y - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.intersectObjects([this.body, ...this.picks], false)[0];
    return hit?.object.userData.id as string | undefined;
  }
  private down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.gestures.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      moved: false,
    });
    if (this.gestures.size > 1) this.multi = true;
  };
  private move = (e: PointerEvent) => {
    const p = this.gestures.get(e.pointerId);
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 7) p.moved = true;
    if (!this.gestures.size && e.pointerType === "mouse" && !this.flying) {
      const id = this.hit(e.clientX, e.clientY);
      if (id !== this.hovered) {
        this.hovered = id;
        this.setColors();
        this.onHover(id);
      }
      this.renderer.domElement.style.cursor = id ? "pointer" : "grab";
    }
  };
  private cancel = (e: PointerEvent) => {
    this.gestures.delete(e.pointerId);
    if (!this.gestures.size) this.multi = false;
  };
  private up = (e: PointerEvent) => {
    const p = this.gestures.get(e.pointerId),
      multi = this.multi;
    this.cancel(e);
    if (
      !p ||
      p.moved ||
      multi ||
      Math.hypot(e.clientX - p.x, e.clientY - p.y) > 7
    )
      return;
    const id = this.hit(e.clientX, e.clientY);
    if (id) this.onPick(id);
  };
  private leave = () => {
    this.hovered = undefined;
    this.setColors();
    this.onHover();
  };
  private hint = new Set<string>();
  private setColors() {
    for (const [id, v] of this.visuals) {
      if (v.animation) continue;
      v.material.color.set(
        this.hint.has(id)
          ? "#a65d14"
          : this.hovered === id
            ? "#287ca3"
            : "#182e30",
      );
      v.material.emissive.set("#000000");
    }
  }
  highlight(ids: string[]) {
    this.hint = new Set(ids);
    this.setColors();
  }
  reset() {
    const aspect = Math.max(0.48, Math.min(1, this.camera.aspect)),
      d = 20 / Math.sqrt(aspect);
    this.base.controls.target.set(0, 0, 0);
    this.camera.position.copy(
      new T.Vector3(1, 0.85, 1.25).normalize().multiplyScalar(d),
    );
    this.base.controls.minDistance = 10;
    this.base.controls.maxDistance = 35;
    this.base.controls.update();
  }
  face(normal: readonly number[]) {
    this.camera.position.copy(
      new T.Vector3(...normal)
        .multiplyScalar(16)
        .add(new T.Vector3(0.001, 0.001, 0.001)),
    );
    this.base.controls.update();
  }
  private cellPoint(c: Cell) {
    const p = position(c, this.size),
      n = faces[c.face].n;
    return new T.Vector3(
      ...(p.map((v, i) => (v * 3) / this.size + n[i] * 0.045) as [
        number,
        number,
        number,
      ]),
    );
  }
  private points(a: SurfaceArrow) {
    const points: T.Vector3[] = [];
    for (let i = 0; i < a.path.length; i++) {
      const c = a.path[i],
        p = this.cellPoint(c);
      if (i && c.face !== a.path[i - 1].face) {
        const prev = a.path[i - 1],
          old = this.cellPoint(prev),
          n1 = new T.Vector3(...faces[prev.face].n),
          n2 = new T.Vector3(...faces[c.face].n);
        const edge = old.clone().lerp(p, 0.5);
        edge.addScaledVector(n1, 3.045 - edge.dot(n1));
        edge.addScaledVector(n2, 3.045 - edge.dot(n2));
        points.push(edge);
      }
      points.push(p);
    }
    return points;
  }
  private tube(points: T.Vector3[]) {
    const curve = new Polyline(points);
    return new T.TubeGeometry(
      curve,
      Math.max(12, Math.ceil(curve.total * 12)),
      0.027,
      6,
      false,
    );
  }
  setLevel(l: SurfaceLevel) {
    this.size = l.size;
    for (const v of this.visuals.values()) this.free(v);
    this.visuals.clear();
    this.picks = [];
    this.hint.clear();
    this.hovered = undefined;
    this.flying = false;
    for (const a of l.arrows) {
      const group = new T.Group(),
        points = this.points(a),
        poly = new Polyline(points),
        head = a.path.at(-1)!,
        dir = new T.Vector3(...direction(head.face, a.heading)),
        normal = new T.Vector3(...faces[head.face].n),
        side = new T.Vector3().crossVectors(normal, dir),
        material = new T.MeshStandardMaterial({
          color: "#182e30",
          roughness: 0.7,
        });
      const line = new T.Mesh(this.tube(points), material),
        tipGeometry = new T.BufferGeometry();
      const pointsTip = [
        dir.clone().multiplyScalar(0.21),
        dir.clone().multiplyScalar(-0.14).addScaledVector(side, 0.13),
        dir.clone().multiplyScalar(-0.14).addScaledVector(side, -0.13),
      ];
      tipGeometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(
          pointsTip.flatMap((p) => p.toArray()),
          3,
        ),
      );
      tipGeometry.computeVertexNormals();
      const tip = new T.Mesh(tipGeometry, material);
      tip.position.copy(points.at(-1)!);
      group.add(line, tip);
      for (const m of [line, tip]) {
        m.userData.id = a.id;
        this.picks.push(m);
      }
      this.base.scene.add(group);
      this.visuals.set(a.id, {
        group,
        line,
        tip,
        material,
        points,
        lengths: poly.lengths,
        length: poly.total,
        dir,
        normal,
      });
    }
    this.reset();
  }
  private free(v: Visual) {
    this.base.scene.remove(v.group);
    v.line.geometry.dispose();
    v.tip.geometry.dispose();
    v.material.dispose();
  }
  private pointAt(v: Visual, d: number) {
    if (d >= v.length)
      return v.points
        .at(-1)!
        .clone()
        .addScaledVector(v.dir, d - v.length);
    let i = 1;
    while (i < v.points.length - 1 && v.lengths[i] < d) i++;
    return v.points[i - 1]
      .clone()
      .lerp(
        v.points[i],
        (d - v.lengths[i - 1]) / (v.lengths[i] - v.lengths[i - 1]),
      );
  }
  /** Tail follows the original polyline while the head extends tangentially into space. */
  private slide(v: Visual, d: number) {
    const points = [this.pointAt(v, d)];
    for (let i = 1; i < v.points.length; i++)
      if (v.lengths[i] > d + 1e-5) points.push(v.points[i]);
    const end = this.pointAt(v, v.length + d);
    if (end.distanceTo(points.at(-1)!) > 1e-5) points.push(end);
    v.line.geometry.dispose();
    v.line.geometry = this.tube(points);
    v.tip.position.copy(end);
  }
  fly(id: string, done: () => void) {
    const v = this.visuals.get(id);
    if (!v) {
      done();
      return;
    }
    this.flying = true;
    v.material.color.set("#218cae");
    v.material.transparent = true;
    v.animation = { kind: "fly", start: performance.now(), done };
  }
  blocked(id: string) {
    const v = this.visuals.get(id);
    if (v) v.animation = { kind: "blocked", start: performance.now() };
  }
  private tick = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const now = performance.now();
    for (const [id, v] of this.visuals) {
      const a = v.animation;
      if (!a) continue;
      const reduced = this.base.reduced,
        t = Math.min(
          1,
          (now - a.start) / (reduced ? 100 : a.kind === "fly" ? 1100 : 420),
        );
      if (a.kind === "fly") {
        if (!reduced) this.slide(v, (v.length + 8) * t * t);
        v.material.opacity = reduced
          ? 1 - t
          : 1 - Math.max(0, (t - 0.82) / 0.18);
      } else v.material.color.set(t < 0.8 ? "#b74b39" : "#182e30");
      if (t === 1) {
        v.animation = undefined;
        if (a.kind === "fly") {
          this.free(v);
          this.picks = this.picks.filter((m) => m.userData.id !== id);
          this.visuals.delete(id);
          this.flying = false;
          a.done?.();
        }
        this.setColors();
      }
    }
  };
  project(id: string) {
    const v = this.visuals.get(id);
    if (!v) return null;
    const p = v.points.at(-1)!.clone().project(this.camera),
      r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: r.left + ((p.x + 1) * r.width) / 2,
      y: r.top + ((1 - p.y) * r.height) / 2,
    };
  }
  visibleIds() {
    return [...this.visuals.keys()].filter((id) => {
      const p = this.project(id)!;
      return this.hit(p.x, p.y) === id;
    });
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    const c = this.renderer.domElement;
    c.removeEventListener("pointerdown", this.down);
    c.removeEventListener("pointermove", this.move);
    c.removeEventListener("pointerup", this.up);
    c.removeEventListener("pointercancel", this.cancel);
    c.removeEventListener("pointerleave", this.leave);
    for (const v of this.visuals.values()) this.free(v);
    this.body.geometry.dispose();
    (this.body.material as T.Material).dispose();
    this.edges.geometry.dispose();
    (this.edges.material as T.Material).dispose();
    this.base.dispose();
  }
}
