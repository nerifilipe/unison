import { test, expect } from "@playwright/test";

test("initial load stays within asset budgets and defers audio until play", async ({
  page,
  request,
}, info) => {
  const media: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/media/"))
      media.push(req.url());
  });
  const response = await page.goto("/");
  expect(response?.headers()["cache-control"]).toContain("no-cache");
  await expect(page.locator(".track-card").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(media).toEqual([]);
  const assets = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (entry): entry is PerformanceResourceTiming =>
          entry instanceof PerformanceResourceTiming &&
          new URL(entry.name).pathname.startsWith("/assets/"),
      )
      .map((entry) => ({
        url: entry.name,
        transferred: entry.transferSize,
        encoded: entry.encodedBodySize,
        decoded: entry.decodedBodySize,
      })),
  );
  const js = assets.filter((asset) => asset.url.endsWith(".js"));
  expect(js.length).toBeGreaterThan(0);
  expect(js.reduce((total, asset) => total + asset.encoded, 0)).toBeLessThan(
    120 * 1024,
  );
  expect(
    assets.reduce((total, asset) => total + asset.encoded, 0),
  ).toBeLessThan(250 * 1024);
  const script = await request.get(js[0].url, {
    headers: { "Accept-Encoding": "gzip" },
  });
  expect(script.headers()["content-encoding"]).toBe("gzip");
  expect(script.headers()["cache-control"]).toContain("immutable");
  expect(script.headers()["vary"]).toContain("Accept-Encoding");
  const missing = await request.get("/assets/missing-chunk.js");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["cache-control"] ?? "").not.toContain("immutable");
  const privateResponse = await request.get("/api/auth/csrf");
  expect(privateResponse.headers()["cache-control"]).toContain("no-store");
  await info.attach("initial-assets", {
    body: JSON.stringify(assets, null, 2),
    contentType: "application/json",
  });
  await page
    .getByRole("button", { name: "Play First Light", exact: true })
    .click();
  await expect.poll(() => media.length).toBeGreaterThan(0);
});
