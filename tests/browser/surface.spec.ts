import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__surface);
}
async function choose(page: Page, id: string) {
  await page.locator("#access-button").click();
  await page.locator(`[data-arrow="${id}"]`).click();
  await page.waitForFunction(() => !(window as any).__surface.busy);
}
for (let id = 1; id <= 5; id++)
  test(`surface cube ${id}: solve every folded path using the UI`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page);
    await page.locator("#levels-button").click();
    await page.locator(`[data-level="${id}"]`).click();
    while (await page.evaluate(() => (window as any).__surface.state.length)) {
      const move = await page.evaluate(
        () => (window as any).__surface.moves()[0],
      );
      await choose(page, move);
    }
    await expect(page.locator("#modal h2")).toHaveText("Der Weg ist frei.");
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("vector-surface-v2")!).completed,
      ),
    ).toContain(id);
  });
test("surface: desktop/mobile visuals and opaque body prevents clicking hidden paths", async ({
  page,
}) => {
  await ready(page);
  await page.screenshot({
    path: "test-results/surface-desktop.png",
    fullPage: true,
  });
  const visible = await page.evaluate(() =>
    (window as any).__surface.view.visibleIds(),
  );
  const all = await page.evaluate(() => (window as any).__surface.state.length);
  expect(visible.length).toBeLessThan(all);
  expect(visible.length).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__surface.start(5));
  await page.screenshot({
    path: "test-results/surface-dense.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#camera-button").click();
  await page.screenshot({
    path: "test-results/surface-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("surface: blocked feedback, drag suppression and physical raycast removal", async ({
  page,
}) => {
  await ready(page);
  const id = await page.evaluate(() => {
    const v = (window as any).__surface;
    return v.state.find((a: any) => !v.moves().includes(a.id)).id;
  });
  await choose(page, id);
  await expect(page.locator("#status")).toContainText("Noch versperrt");
  const before = await page.evaluate(
    () => (window as any).__surface.state.length,
  );
  await page.waitForTimeout(450);
  const canvas = await page.locator("#scene").boundingBox();
  await page.mouse.move(
    canvas!.x + canvas!.width / 2,
    canvas!.y + canvas!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas!.x + canvas!.width / 2 + 80,
    canvas!.y + canvas!.height / 2 + 20,
    { steps: 8 },
  );
  await page.mouse.up();
  expect(
    await page.evaluate(() => (window as any).__surface.state.length),
  ).toBe(before);
  const move = await page.evaluate(() => {
    const v = (window as any).__surface;
    return v.moves()[0];
  });
  await page.evaluate((move) => {
    const v = (window as any).__surface,
      a = v.state.find((a: any) => a.id === move),
      ns: any = {
        front: [0, 0, 1],
        back: [0, 0, -1],
        right: [1, 0, 0],
        left: [-1, 0, 0],
        top: [0, 1, 0],
        bottom: [0, -1, 0],
      };
    v.view.face(ns[a.path.at(-1).face]);
  }, move);
  await page.waitForTimeout(80);
  const p = await page.evaluate(
    (move) => (window as any).__surface.view.project(move),
    move,
  );
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => !(window as any).__surface.busy);
  expect(
    await page.evaluate(() => (window as any).__surface.state.length),
  ).toBe(before - 1);
});
test("surface: long path follows its bends while head moves tangentially", async ({
  page,
}) => {
  await ready(page);
  const id = await page.evaluate(() => (window as any).__surface.moves()[0]);
  await page.locator("#access-button").click();
  await page.locator(`[data-arrow="${id}"]`).click();
  await page.waitForTimeout(350);
  const metrics = await page.evaluate((id) => {
    const v = (window as any).__surface.view.visuals.get(id);
    if (!v) return null;
    const d = v.tip.position.clone().sub(v.points.at(-1));
    return {
      headMoved: d.length(),
      cross: d.clone().cross(v.dir).length(),
      stillCurved: v.line.geometry.parameters.path.points.length > 2,
    };
  }, id);
  expect(metrics).not.toBeNull();
  expect(metrics!.headMoved).toBeGreaterThan(0);
  expect(metrics!.cross).toBeLessThan(0.0001);
  expect(metrics!.stillCurved).toBe(true);
});
test("surface: touch taps select a path and pinch/drag never remove one", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForFunction(() => !!(window as any).__surface);
  const visible = await page.evaluate(
    () => (window as any).__surface.view.visibleIds()[0],
  );
  const p = await page.evaluate(
    (id) => (window as any).__surface.view.project(id),
    visible,
  );
  const before = await page.evaluate(
    () => (window as any).__surface.state.length,
  );
  const isFree = await page.evaluate(
    (id) => (window as any).__surface.moves().includes(id),
    visible,
  );
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForFunction(() => !(window as any).__surface.busy);
  expect(
    await page.evaluate(() => (window as any).__surface.state.length),
  ).toBe(before - (isFree ? 1 : 0));
  const after = await page.evaluate(
      () => (window as any).__surface.state.length,
    ),
    c = await context.newCDPSession(page),
    b = await page.locator("#scene").boundingBox(),
    x = b!.x + b!.width / 2,
    y = b!.y + b!.height / 2;
  await c.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 60, y: y + 10, id: 1 }],
  });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 25, y, id: 1 },
      { x: x + 25, y, id: 2 },
    ],
  });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 60, y, id: 1 },
      { x: x + 60, y, id: 2 },
    ],
  });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(
    await page.evaluate(() => (window as any).__surface.state.length),
  ).toBe(after);
  await context.close();
});
test("surface: new progress does not overwrite the old campaign", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "vector-save-v1",
      JSON.stringify({
        version: 1,
        current: 8,
        unlocked: 12,
        results: { 1: { stars: 3, mistakes: 0, hints: 0 } },
        sound: false,
        mode: "zen",
      }),
    ),
  );
  await ready(page);
  await page.locator("#settings-button").click();
  await page.locator("#reset-save").click();
  await page.locator("#confirm-reset").click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("vector-save-v1")!).unlocked,
    ),
  ).toBe(12);
  await page.locator('a[href="?classic=1"]').click();
  await page.waitForFunction(() => !!(window as any).__vector);
  await expect(page.locator("#stage-level")).toHaveText("LEVEL 08");
});
