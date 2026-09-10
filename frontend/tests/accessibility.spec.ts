import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";

async function scan(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page }).analyze();
  await info.attach(name, {
    body: JSON.stringify({
      violations: result.violations,
      incomplete: result.incomplete,
    }),
    contentType: "application/json",
  });
  expect
    .soft(
      result.violations.map((v) => ({
        rule: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          detail: n.failureSummary,
        })),
      })),
      name,
    )
    .toEqual([]);
}

test("public pages and credits have accessible semantics and contrast", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto("/");
  await expect(page.locator(".track-card").first()).toBeVisible();
  await scan(page, info, "discover");
  await page
    .getByRole("button", { name: "Credits for First Light", exact: true })
    .click();
  await expect(page.locator("dialog")).toBeVisible();
  await scan(page, info, "credits");
  await page.keyboard.press("Escape");
  for (const path of ["/about", "/account", "/favorites", "/not-a-page"]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await scan(page, info, path);
  }
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await scan(page, info, "registration");
  await page.route("**/api/tracks", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await scan(page, info, "catalog-error");
  await page.unroute("**/api/tracks");
  await page.route("**/api/tracks", (route) => route.fulfill({ json: [] }));
  await page.reload();
  await expect(page.getByText("The catalog is quiet.")).toBeVisible();
  await scan(page, info, "empty-catalog");
});

test("private forms, playlists and room controls are accessible", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 900 });
  const request = page.request;
  async function mutate(
    path: string,
    method: string,
    data?: Record<string, unknown>,
    form = false,
  ) {
    const csrf = await (await request.get("/api/auth/csrf")).json();
    const response = await request.fetch(path, {
      method,
      headers: { [csrf.headerName]: csrf.token },
      ...(data
        ? form
          ? { form: data as Record<string, string> }
          : { data }
        : {}),
    });
    expect(response.ok()).toBeTruthy();
    return response;
  }
  const credentials = {
    email: `unison-e2e-${randomUUID()}@example.test`,
    password: "Accessibility-review-2026",
  };
  await mutate("/api/auth/register", "POST", {
    ...credentials,
    displayName: "Accessibility listener",
  });
  await mutate("/api/auth/login", "POST", credentials, true);
  const playlist = await (
    await mutate("/api/library/playlists", "POST", {
      name: "Evening listening",
      description: "A calmer end to the day.",
    })
  ).json();
  let roomId: string | undefined;
  try {
    for (const path of ["/favorites", `/library/${playlist.id}`]) {
      await page.goto(path);
      await expect(page.locator("main .message-state")).toBeVisible();
      await scan(page, info, `empty-${path}`);
    }
    await mutate(
      `/api/library/playlists/${playlist.id}/tracks/first-light`,
      "PUT",
    );
    await mutate("/api/library/favorites/first-light", "PUT");
    for (const path of [
      "/account",
      "/uploads",
      "/library",
      "/favorites",
      `/library/${playlist.id}`,
      "/rooms",
    ]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("main [role=status]")).toHaveCount(0);
      await scan(page, info, path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} reflows`,
      ).toBe(true);
    }
    await page.goto("/");
    await page
      .getByRole("button", { name: "Add First Light to playlist", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Evening listening/ }),
    ).toBeVisible();
    await scan(page, info, "playlist-picker");
    await page.keyboard.press("Escape");
    const room = await (
      await mutate("/api/rooms", "POST", { name: "Accessibility room" })
    ).json();
    roomId = room.id;
    await mutate(`/api/rooms/${room.id}/queue`, "POST", {
      trackId: "first-light",
    });
    await page.goto(`/rooms/${room.id}`);
    await page.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(
      page.getByText("Live · synchronized", { exact: true }),
    ).toBeVisible();
    await scan(page, info, "active-room");
  } finally {
    if (roomId) await mutate(`/api/rooms/${roomId}/membership`, "DELETE");
    await mutate(`/api/library/playlists/${playlist.id}`, "DELETE");
    await mutate("/api/library/favorites/first-light", "DELETE");
  }
});

test("keyboard navigation skips the menu and returns focus from dialogs", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".track-card").first()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  const trigger = page.getByRole("button", {
    name: "Credits for First Light",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Track credits" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    // Chromium may move to browser chrome; background page controls stay inert.
    await page.evaluate(
      () =>
        document.activeElement === document.body ||
        !!document.activeElement?.closest("dialog"),
    ),
  ).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("link", { name: "About Unison", exact: true }).click();
  await expect(page.locator("main")).toBeFocused();
  await expect(page).toHaveTitle(/About Unison/);
});
