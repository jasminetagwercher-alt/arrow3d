import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/?classic=1");
  await page.waitForFunction(() => !!(window as any).__vector);
}
async function choose(page: Page, id: string) {
  await page.locator("#access-button").click();
  await page.locator(`[data-arrow="${id}"]`).click();
  await page.waitForFunction(() => !(window as any).__vector.busy);
}
test("all five tutorial levels can be completed through UI without console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  for (let n = 1; n <= 5; n++) {
    await expect(page.locator("#stage-level")).toHaveText(`LEVEL 0${n}`);
    while (
      await page.evaluate(() => (window as any).__vector.state.length > 0)
    ) {
      const id = await page.evaluate(() => (window as any).__vector.moves()[0]);
      await choose(page, id);
    }
    await expect(page.locator("#modal h2")).toHaveText("Raum geschaffen.");
    if (n < 5) await page.locator("#next-button").click();
  }
  expect(errors).toEqual([]);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__vector);
  await page.locator("#levels-button").click();
  await expect(page.locator('[data-level="5"]')).toBeEnabled();
});
test("raycast hit removes arrow, drag does not click, blocked arrow remains", async ({
  page,
}) => {
  await ready(page);
  const p = await page.evaluate(() => (window as any).__vector.project("a02"));
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => !(window as any).__vector.busy);
  await expect(page.locator("#remaining-label")).toHaveText(
    "2 Pfeile verbleibend",
  );
  const before = await page.evaluate(
    () => (window as any).__vector.state.length,
  );
  const q = await page.evaluate(() => (window as any).__vector.project("a01"));
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x + 80, q.y + 30, { steps: 10 });
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__vector.state.length)).toBe(
    before,
  );
  await page.evaluate(() => (window as any).__vector.start(2));
  await choose(page, "a01");
  await expect(page.locator("#remaining-label")).toHaveText(
    "4 Pfeile verbleibend",
  );
  await expect(page.locator("#status")).toContainText("Noch nicht frei");
});
test("desktop and mobile layout screenshots, no horizontal overflow", async ({
  page,
}) => {
  await ready(page);
  await page.screenshot({
    path: "test-results/vector-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/vector-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("editor validates, edits, exports, generates and tests without advancing campaign", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#editor-button").click();
  await expect(page.locator("#editor-scene canvas")).toBeVisible();
  await page.locator("#edit-solve").click();
  await expect(page.locator("#editor-message")).toContainText("Lösbar ✓");
  await page.locator("#edit-x").fill("3");
  await page.locator("#edit-update").click();
  await expect(page.locator("#editor-message")).toContainText("übernommen");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#edit-export").click();
  expect((await downloadPromise).suggestedFilename()).toBe("vector-level.json");
  await page
    .getByText("JSON bearbeiten / importieren", { exact: true })
    .click();
  await page.locator("#edit-json").fill('{"bad":true}');
  await page.locator("#edit-import").click();
  await expect(page.locator("#editor-message")).toContainText("ungültig");
  await page.getByText("Levelgenerator", { exact: true }).click();
  await page.locator("#gen-count").fill("30");
  await page.locator("#edit-generate").click();
  await expect(page.locator("#editor-message")).toContainText(
    "Lösbares Puzzle",
  );
  await page.locator("#edit-test").click();
  await expect(page.locator("#remaining-label")).toHaveText(
    "30 Pfeile verbleibend",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("vector-save-v1")!).unlocked,
    ),
  ).toBe(1);
});
test("hint stages, challenge feedback, settings persist, safe reset", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#hint-button").click();
  await expect(page.locator("#status")).toContainText("Suche außen");
  await page.locator("#hint-button").click();
  await expect(page.locator("#status")).toContainText("Ebene");
  await page.locator("#hint-button").click();
  await expect(page.locator("#status")).toContainText("freie Bahn");
  await page.locator("#settings-button").click();
  await page.locator("#mode").selectOption("challenge");
  await page.locator("#sound").check();
  await page.locator(".modal-close").click();
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__vector);
  await expect(page.locator("#mode-pill")).toContainText("CHALLENGE");
  await page.locator("#settings-button").click();
  await expect(page.locator("#sound")).toBeChecked();
  await page.locator("#reset-save").click();
  await page.locator("#cancel-reset").click();
  await expect(page.locator("#sound")).toBeChecked();
  await page.locator("#reset-save").click();
  await page.locator("#confirm-reset").click();
  await expect(page.locator("#mode-pill")).toContainText("ZEN");
});
test("touch tap, drag and pinch distinguish gestures", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173/?classic=1");
  await page.waitForFunction(() => !!(window as any).__vector);
  const p = await page.evaluate(() => (window as any).__vector.project("a02"));
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForFunction(() => !(window as any).__vector.busy);
  await expect(page.locator("#remaining-label")).toHaveText(
    "2 Pfeile verbleibend",
  );
  const client = await context.newCDPSession(page),
    box = await page.locator("#scene").boundingBox();
  const x = box!.x + box!.width / 2,
    y = box!.y + box!.height / 2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 60, y: y + 20, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 30, y, id: 1 },
      { x: x + 30, y, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 70, y, id: 1 },
      { x: x + 70, y, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator("#remaining-label")).toHaveText(
    "2 Pfeile verbleibend",
  );
  await context.close();
});
test("large campaign levels render, redraw and release resources", async ({
  page,
}) => {
  await ready(page);
  const samples = [];
  for (const count of [10, 30, 50, 100, 150]) {
    await page.evaluate(
      (count) => (window as any).__vector.startGenerated(count),
      count,
    );
    await page.waitForTimeout(180);
    samples.push(
      await page.evaluate(() => {
        const v = (window as any).__vector;
        return {
          id: v.level.id,
          arrows: v.state.length,
          calls: v.scene.renderer.info.render.calls,
          geometries: v.scene.renderer.info.memory.geometries,
        };
      }),
    );
  }
  console.log("render samples", JSON.stringify(samples));
  expect(samples.at(-1).arrows).toBe(150);
  expect(samples.at(-1).geometries).toBeLessThan(10);
  await page.evaluate(() => (window as any).__vector.start(100));
  await page.screenshot({
    path: "test-results/vector-level100.png",
    fullPage: true,
  });
  await page.evaluate(() => (window as any).__vector.start(25));
  await page.screenshot({
    path: "test-results/vector-level25.png",
    fullPage: true,
  });
  for (const [width, height] of [
    [768, 1024],
    [1024, 768],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
