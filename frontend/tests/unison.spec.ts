import { test, expect } from "@playwright/test";

test("real catalog, S3 range requests, playback and persistent navigation", async ({
  page,
  request,
}) => {
  const api = await request.get("/api/tracks");
  expect(api.ok()).toBeTruthy();
  const tracks = await api.json();
  expect(tracks).toHaveLength(3);
  for (const track of tracks) {
    const media = await request.get(track.audioUrl, {
      headers: { Range: "bytes=0-43" },
    });
    expect(media.status()).toBe(206);
    expect(media.headers()["content-type"]).toContain("audio/wav");
    expect(media.headers()["content-range"]).toMatch(/^bytes 0-43\//);
    expect((await media.body()).subarray(0, 4).toString()).toBe("RIFF");
  }
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "First Light", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play First Light", exact: true })
    .click();
  const audio = page.locator("audio");
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThan(0.3);
  const before = await audio.evaluate((element: HTMLAudioElement) => {
    element.dataset.identity = "persistent";
    return element.currentTime;
  });
  await page.getByRole("link", { name: "About Unison", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A shared love of sound." }),
  ).toBeVisible();
  await expect(audio).toHaveAttribute("data-identity", "persistent");
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThan(before);
  expect(
    await audio.evaluate((element: HTMLAudioElement) => element.paused),
  ).toBe(false);
  await page.getByRole("slider", { name: "Seek", exact: true }).fill("30");
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThanOrEqual(30);
  await page.getByRole("slider", { name: "Volume", exact: true }).fill("0.25");
  expect(
    await audio.evaluate((element: HTMLAudioElement) => element.volume),
  ).toBe(0.25);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(
    await audio.evaluate((element: HTMLAudioElement) => element.paused),
  ).toBe(true);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused))
    .toBe(false);
  await page.getByRole("link", { name: "Discover", exact: true }).click();
  await page
    .getByRole("button", { name: "Play Slow Orbit", exact: true })
    .click();
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentSrc),
    )
    .toContain("slow-orbit.wav");
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThan(0.2);
  await page
    .getByRole("button", { name: "Restart track", exact: true })
    .isVisible()
    .then(async (visible) => {
      if (visible) {
        await page
          .getByRole("button", { name: "Restart track", exact: true })
          .click();
      }
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("loading, API failure and retry", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tracks", async (route) => {
    await gate;
    await route.fulfill({ status: 503, body: "{}" });
  });
  await page.goto("/");
  await expect(page.getByText("Finding your frequencies…")).toBeVisible();
  release();
  await expect(page.getByRole("alert")).toContainText(
    "We couldn't reach the catalog.",
  );
  await page.unroute("**/api/tracks");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "First Light", exact: true }),
  ).toBeVisible();
});

test("empty catalog and search with no results", async ({ page }) => {
  await page.route("**/api/tracks", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await expect(page.getByText("The catalog is quiet.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start listening" }),
  ).toBeDisabled();
  await page.unroute("**/api/tracks");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "First Light", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search catalog" })
    .fill("nothing-like-this");
  await expect(page.getByText("No sounds found.")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.getByRole("heading", { name: "First Light", exact: true }),
  ).toBeVisible();
});

test("media error can be retried", async ({ page }) => {
  await page.route("**/media/**", (route) => route.abort());
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play First Light", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.unroute("**/media/**");
  await page.getByRole("button", { name: "Retry audio" }).click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThan(0.2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("direct navigation and desktop/mobile layout", async ({
  page,
}, testInfo) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "A shared love of sound." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Discover" }).click();
  await expect(
    page.getByRole("heading", { name: "First Light", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("discover.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
