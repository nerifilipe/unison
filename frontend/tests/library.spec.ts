import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = "Test-only-password-2026";
const identity = () => ({
  email: `unison-e2e-${randomUUID()}@example.test`,
  password,
  displayName: "Test Listener",
});

async function mutate(
  request: APIRequestContext,
  path: string,
  method: string,
  body?: unknown,
  form = false,
) {
  const token = await (await request.get("/api/auth/csrf")).json();
  return request.fetch(path, {
    method,
    headers: { [token.headerName]: token.token },
    ...(body
      ? form
        ? { form: body as Record<string, string> }
        : { data: body }
      : {}),
  });
}
async function register(request: APIRequestContext) {
  const account = identity();
  expect(
    (await mutate(request, "/api/auth/register", "POST", account)).status(),
  ).toBe(201);
  const beforeLogin = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "JSESSIONID",
  )?.value;
  expect(
    (
      await mutate(
        request,
        "/api/auth/login",
        "POST",
        { email: account.email, password },
        true,
      )
    ).status(),
  ).toBe(204);
  const afterLogin = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "JSESSIONID",
  )?.value;
  expect(beforeLogin).toBeTruthy();
  expect(afterLogin).toBeTruthy();
  expect(afterLogin).not.toBe(beforeLogin);
  return account;
}
async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name, exact: true })
    .click();
}

test("failed favorite mutation leaves state intact and can be retried", async ({
  page,
}) => {
  await register(page.request);
  await page.goto("/");
  const save = page.getByRole("button", {
    name: "Save First Light to favorites",
    exact: true,
  });
  await expect(save).toBeEnabled();
  await page.route("**/api/library/favorites/first-light", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Could not save your favorite." },
    }),
  );
  await save.click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save your favorite.",
  );
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await page.unroute("**/api/library/favorites/first-light");
  await save.click();
  await expect(
    page.getByRole("button", {
      name: "Remove First Light from favorites",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("register, favorites, playlist CRUD and ordering persist; player survives authentication", async ({
  page,
}, testInfo) => {
  const account = identity();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play First Light", exact: true })
    .click();
  const audio = page.locator("audio");
  await expect
    .poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(0.2);
  await audio.evaluate((a) =>
    a.setAttribute("data-session-proof", "same-player"),
  );
  await page.locator(".account-menu a").click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByLabel("Display name", { exact: true })
    .fill(account.displayName);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: false }).fill(password);
  await page
    .getByRole("button", { name: "Create your account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your library", exact: true }),
  ).toBeVisible();
  await expect(audio).toHaveAttribute("data-session-proof", "same-player");
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(false);
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  await page
    .getByLabel("Playlist name", { exact: true })
    .fill("Evening Signals");
  await page
    .getByLabel("Description", { exact: false })
    .fill("A quieter end to the day.");
  await page
    .getByRole("button", { name: "Create playlist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evening Signals", exact: true }),
  ).toBeVisible();
  const playlistUrl = page.url();
  await navigate(page, "Discover");
  await page
    .getByRole("button", { name: "Save First Light to favorites", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remove First Light from favorites",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const title of ["First Light", "Slow Orbit"]) {
    await page
      .getByRole("button", { name: `Add ${title} to playlist`, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Evening Signals/ })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await navigate(page, "Favorites");
  await expect(
    page.getByRole("heading", { name: "First Light", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "First Light", exact: true }),
  ).toBeVisible();
  await page.goto(playlistUrl);
  await expect(page.locator(".playlist-track")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Move Slow Orbit up", exact: true })
    .click();
  await expect(page.locator(".playlist-track").first()).toHaveAttribute(
    "data-track-id",
    "slow-orbit",
  );
  await page.reload();
  await expect(page.locator(".playlist-track").first()).toHaveAttribute(
    "data-track-id",
    "slow-orbit",
  );
  await page
    .getByRole("button", { name: "Edit playlist", exact: true })
    .click();
  await page
    .getByLabel("Playlist name", { exact: true })
    .fill("Night Frequencies");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Night Frequencies", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("playlist.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", {
      name: "Remove First Light from playlist",
      exact: true,
    })
    .click();
  await expect(page.locator(".playlist-track")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Delete playlist", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep playlist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Night Frequencies", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete playlist", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your first playlist starts here." }),
  ).toBeVisible();
  await navigate(page, "Favorites");
  await page
    .getByRole("button", {
      name: "Remove First Light from favorites",
      exact: true,
    })
    .click();
  await expect(page.getByText("Nothing saved. Yet.")).toBeVisible();
  await page.locator(".account-menu a").click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in to Unison" }),
  ).toBeVisible();
  await navigate(page, "Your library");
  await expect(
    page.getByRole("link", { name: "Sign in to continue" }),
  ).toBeVisible();
});

test("API enforces CSRF, account isolation, valid membership and logout", async ({
  playwright,
  baseURL,
}) => {
  const owner = await playwright.request.newContext({ baseURL });
  const other = await playwright.request.newContext({ baseURL });
  const anonymous = await playwright.request.newContext({ baseURL });
  try {
    expect((await anonymous.get("/api/tracks")).status()).toBe(200);
    expect((await anonymous.get("/api/library/playlists")).status()).toBe(401);
    expect(
      (
        await anonymous.post("/api/auth/register", { data: identity() })
      ).status(),
    ).toBe(403);
    expect(
      (
        await mutate(anonymous, "/api/auth/register", "POST", {
          ...identity(),
          password: "short",
        })
      ).status(),
    ).toBe(400);
    const account = await register(owner);
    const session = (await owner.storageState()).cookies.find(
      (cookie) => cookie.name === "JSESSIONID",
    );
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    const me = await (await owner.get("/api/auth/me")).json();
    expect(me.email).toBe(account.email);
    expect(me).not.toHaveProperty("passwordHash");
    expect(
      (
        await mutate(anonymous, "/api/auth/register", "POST", {
          ...account,
          email: account.email.toUpperCase(),
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await mutate(
          anonymous,
          "/api/auth/login",
          "POST",
          { email: account.email, password: "wrong-password" },
          true,
        )
      ).status(),
    ).toBe(401);
    expect(
      (await owner.put("/api/library/favorites/first-light")).status(),
    ).toBe(403);
    expect(
      (
        await mutate(owner, "/api/library/favorites/missing-track", "PUT")
      ).status(),
    ).toBe(404);
    await mutate(owner, "/api/library/favorites/first-light", "PUT");
    await mutate(owner, "/api/library/favorites/first-light", "PUT");
    expect(
      await (await owner.get("/api/library/favorites")).json(),
    ).toHaveLength(1);
    const playlist = await (
      await mutate(owner, "/api/library/playlists", "POST", {
        name: "Private test",
        description: "",
      })
    ).json();
    const path = `/api/library/playlists/${playlist.id}`;
    await register(other);
    expect(await (await other.get("/api/library/favorites")).json()).toEqual(
      [],
    );
    expect(await (await other.get("/api/library/playlists")).json()).toEqual(
      [],
    );
    expect((await other.get(path)).status()).toBe(404);
    for (const [method, suffix, body] of [
      ["PUT", "", { name: "Stolen" }],
      ["DELETE", "", undefined],
      ["PUT", "/tracks/first-light", undefined],
      ["DELETE", "/tracks/first-light", undefined],
      ["PUT", "/order", { trackIds: [] }],
    ] as const)
      expect((await mutate(other, path + suffix, method, body)).status()).toBe(
        404,
      );
    await Promise.all(
      ["first-light", "slow-orbit"].map((track) =>
        mutate(owner, `${path}/tracks/${track}`, "PUT"),
      ),
    );
    await mutate(owner, `${path}/tracks/first-light`, "PUT");
    expect((await (await owner.get(path)).json()).tracks).toHaveLength(2);
    expect(
      (
        await mutate(owner, `${path}/order`, "PUT", {
          trackIds: ["first-light", "first-light"],
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await mutate(owner, `${path}/order`, "PUT", { trackIds: ["tidal"] })
      ).status(),
    ).toBe(409);
    expect(
      (
        await mutate(owner, `${path}/order`, "PUT", {
          trackIds: ["slow-orbit", "first-light"],
        })
      ).status(),
    ).toBe(204);
    expect(
      (await (await owner.get(path)).json()).tracks.map(
        (t: { id: string }) => t.id,
      ),
    ).toEqual(["slow-orbit", "first-light"]);
    const stale = await playwright.request.newContext({
      baseURL,
      storageState: await owner.storageState(),
    });
    try {
      expect((await mutate(owner, "/api/auth/logout", "POST")).status()).toBe(
        204,
      );
      expect((await owner.get("/api/auth/me")).status()).toBe(401);
      expect((await stale.get("/api/library/playlists")).status()).toBe(401);
    } finally {
      await stale.dispose();
    }
    expect(
      (
        await mutate(
          owner,
          "/api/auth/login",
          "POST",
          { email: account.email, password },
          true,
        )
      ).status(),
    ).toBe(204);
    expect((await (await owner.get(path)).json()).name).toBe("Private test");
    await mutate(owner, path, "DELETE");
    await mutate(owner, "/api/library/favorites/first-light", "DELETE");
  } finally {
    await owner.dispose();
    await other.dispose();
    await anonymous.dispose();
  }
});

test("library errors retry, session expiry hides private content, anonymous prompt is clear", async ({
  page,
}) => {
  await page.goto("/library");
  await expect(
    page.getByRole("link", { name: "Sign in to continue" }),
  ).toBeVisible();
  await register(page.request);
  await page.route("**/api/library/playlists", (route) =>
    route.fulfill({ status: 503, json: { message: "Temporary test outage." } }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Temporary test outage.");
  await page.unroute("**/api/library/playlists");
  await page.getByRole("button", { name: "Retry playlists" }).click();
  await expect(
    page.getByText("Your first playlist starts here."),
  ).toBeVisible();
  await mutate(page.request, "/api/auth/logout", "POST");
  await page.getByRole("button", { name: "New playlist" }).click();
  await page
    .getByLabel("Playlist name", { exact: true })
    .fill("Expired session");
  await page
    .getByRole("button", { name: "Create playlist", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Sign in to continue" }),
  ).toBeVisible();
});
