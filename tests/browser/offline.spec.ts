import { test, expect } from "@playwright/test";
test("production app reloads offline with every surface level and its icons cached", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("pageerror", e.message);
  });
  page.on("requestfailed", (r) => console.log("failed", r.url(), r.failure()));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("console", m.text());
  });
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.locator("#stage-level")).toHaveText("WÜRFEL 01");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator("#stage-level")).toHaveText("WÜRFEL 01");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#stage-level")).toHaveText("WÜRFEL 01");
  await page.locator("#levels-button").click();
  await expect(page.locator("[data-level]")).toHaveCount(5);
  expect(errors).toEqual([]);
  await context.close();
});
