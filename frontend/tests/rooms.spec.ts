import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

async function headers(request: APIRequestContext) {
  const token = await (await request.get("/api/auth/csrf")).json();
  return { [token.headerName]: token.token };
}
async function change(
  request: APIRequestContext,
  path: string,
  method: string,
  data?: unknown,
) {
  return request.fetch(path, {
    method,
    headers: await headers(request),
    ...(data === undefined ? {} : { data }),
  });
}
async function register(request: APIRequestContext, name: string) {
  const account = {
    email: `unison-e2e-${randomUUID()}@example.test`,
    password: "Rooms-test-password-2026",
    displayName: name,
  };
  expect(
    (await change(request, "/api/auth/register", "POST", account)).status(),
  ).toBe(201);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: await headers(request),
        form: { email: account.email, password: account.password },
      })
    ).status(),
  ).toBe(204);
}
async function audioTime(page: Page) {
  return page
    .locator("audio")
    .evaluate((audio: HTMLAudioElement) => audio.currentTime);
}
async function paused(page: Page) {
  return page
    .locator("audio")
    .evaluate((audio: HTMLAudioElement) => audio.paused);
}

test("two listeners share votes, host playback, seek, reconnect and navigation with one player", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  const guestContext = await browser.newContext({
    baseURL: process.env.UNISON_URL ?? "http://localhost:3000",
    viewport: page.viewportSize() ?? undefined,
  });
  // Deliberately wrong client clock, plus observable socket teardown for a real reconnect.
  await guestContext.addInitScript(() => {
    const now = Date.now.bind(Date);
    Date.now = () => now() + 120000;
    const Native = window.WebSocket;
    (window as unknown as { roomSockets: WebSocket[] }).roomSockets = [];
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        (window as unknown as { roomSockets: WebSocket[] }).roomSockets.push(
          this,
        );
      }
    };
  });
  const guest = await guestContext.newPage();
  try {
    await register(page.request, "Room Host");
    await register(guest.request, "Room Guest");
    await page.goto("/rooms");
    await page.getByLabel("Room name", { exact: true }).fill("After hours");
    await page
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]+$/);
    const id = page.url().split("/").pop()!;
    await expect(
      page.getByText("Live · synchronized", { exact: true }),
    ).toBeVisible();
    await guest.goto(`/rooms/${id}`);
    await guest.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(
      guest.getByText("Live · synchronized", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".room-members")).toContainText("Room Guest");
    await page
      .getByRole("button", { name: "Queue First Light", exact: true })
      .click();
    await expect(page.locator(".room-queue")).toContainText("First Light");
    await guest
      .getByRole("button", { name: "Queue Slow Orbit", exact: true })
      .click();
    await expect(guest.locator(".room-queue")).toContainText("Slow Orbit");
    await guest
      .getByRole("button", { name: "Vote for Slow Orbit", exact: true })
      .click();
    await expect(page.locator(".room-queue-item").first()).toContainText(
      "Slow Orbit",
    );
    await page.getByRole("button", { name: "Play room", exact: true }).click();
    await expect(guest.locator(".room-now h2")).toHaveText("Slow Orbit");
    await page
      .getByRole("button", { name: "Enable room audio", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "Enable room audio", exact: true })
      .click();
    await expect.poll(() => audioTime(page)).toBeGreaterThan(0.3);
    await expect.poll(() => audioTime(guest)).toBeGreaterThan(0.3);
    await expect
      .poll(async () =>
        Math.abs((await audioTime(page)) - (await audioTime(guest))),
      )
      .toBeLessThan(1.2);
    await expect(
      guest.getByRole("button", { name: "Pause room", exact: true }),
    ).toHaveCount(0);
    await expect(
      guest.getByRole("slider", { name: "Seek", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("slider", { name: "Room seek", exact: true })
      .fill("25");
    await expect.poll(() => audioTime(guest)).toBeGreaterThanOrEqual(24);
    await page.getByRole("button", { name: "Pause room", exact: true }).click();
    await expect.poll(() => paused(guest)).toBe(true);
    await page.getByRole("button", { name: "Play room", exact: true }).click();
    await expect.poll(() => paused(guest)).toBe(false);
    await guest
      .locator("audio")
      .evaluate((audio) => audio.setAttribute("data-room-player", "same"));
    await guest
      .getByRole("link", { name: "About Unison", exact: true })
      .click();
    await expect(guest.locator("audio")).toHaveAttribute(
      "data-room-player",
      "same",
    );
    await expect.poll(() => paused(guest)).toBe(false);
    await guest
      .getByRole("link", { name: "In room: After hours", exact: true })
      .click();
    await guestContext.setOffline(true);
    await guest.evaluate(() =>
      (window as unknown as { roomSockets: WebSocket[] }).roomSockets.forEach(
        (socket) => socket.close(),
      ),
    );
    await expect.poll(() => paused(guest)).toBe(true);
    await expect(
      guest.getByText("Connection lost · reconnecting…", { exact: true }),
    ).toBeVisible();
    await guestContext.setOffline(false);
    await expect(
      guest.getByText("Live · synchronized", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect.poll(() => paused(guest)).toBe(false);
    await expect
      .poll(async () =>
        Math.abs((await audioTime(page)) - (await audioTime(guest))),
      )
      .toBeLessThan(1.2);
    await guest.reload();
    await expect(
      guest.getByText("Live · synchronized", { exact: true }),
    ).toBeVisible();
    await guest
      .getByRole("button", { name: "Enable room audio", exact: true })
      .click();
    await expect.poll(() => paused(guest)).toBe(false);
    await expect
      .poll(async () =>
        Math.abs((await audioTime(page)) - (await audioTime(guest))),
      )
      .toBeLessThan(1.2);
    await page
      .getByRole("slider", { name: "Room seek", exact: true })
      .fill("59");
    await expect(page.locator(".room-now h2")).toHaveText("First Light", {
      timeout: 10000,
    });
    await expect(guest.locator(".room-now h2")).toHaveText("First Light");
    await expect.poll(() => audioTime(guest)).toBeGreaterThan(0.2);
    await guest
      .getByRole("button", { name: "Queue Tidal", exact: true })
      .click();
    await expect(page.locator(".room-queue")).toContainText("Tidal");
    await page.screenshot({
      path: info.outputPath("room-host.png"),
      fullPage: true,
    });
    await guest.screenshot({
      path: info.outputPath("room-guest.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "End room", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirm end", exact: true })
      .click();
    await expect(guest.getByRole("alert")).toContainText(/ended|removed/);
    await expect.poll(() => paused(guest)).toBe(true);
  } finally {
    await guestContext.close();
  }
});

test("room API enforces membership, host authority, CSRF, origin and stale revisions", async ({
  request,
  playwright,
}) => {
  const other = await playwright.request.newContext({
    baseURL: process.env.UNISON_URL ?? "http://localhost:3000",
  });
  let id: string | undefined;
  try {
    expect(
      (
        await request.post("/api/rooms", { data: { name: "No CSRF" } })
      ).status(),
    ).toBe(403);
    await register(request, "API Host");
    await register(other, "API Guest");
    const created = await change(request, "/api/rooms", "POST", {
      name: "API room",
    });
    expect(created.status()).toBe(201);
    id = (await created.json()).id;
    const path = `/api/rooms/${id}`;
    expect((await other.get(path)).status()).toBe(404);
    expect(
      (
        await change(other, `${path}/queue`, "POST", { trackId: "first-light" })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.get(`/ws/rooms/${id}`, {
          headers: {
            Origin: "https://untrusted.example",
            Upgrade: "websocket",
            Connection: "Upgrade",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13",
          },
        })
      ).status(),
    ).toBe(403);
    expect((await change(other, `${path}/join`, "POST")).status()).toBe(200);
    const queued = await (
      await change(request, `${path}/queue`, "POST", { trackId: "first-light" })
    ).json();
    expect(
      (
        await change(other, `${path}/control`, "POST", {
          action: "play",
          position: 0,
          revision: queued.revision,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await change(other, `${path}/queue/${queued.queue[0].id}`, "DELETE")
      ).status(),
    ).toBe(403);
    expect(
      (
        await change(other, `${path}/queue`, "POST", { trackId: "first-light" })
      ).status(),
    ).toBe(409);
    const votePath = `${path}/queue/${queued.queue[0].id}/vote`;
    const responses = await Promise.all([
      change(other, votePath, "PUT", { enabled: true }),
      change(other, votePath, "PUT", { enabled: true }),
    ]);
    responses.forEach((response) => expect(response.status()).toBe(200));
    const state = await (await request.get(path)).json();
    expect(state.queue[0].votes).toBe(1);
    const controls = await Promise.all([
      change(request, `${path}/control`, "POST", {
        action: "play",
        position: 0,
        revision: state.revision,
      }),
      change(request, `${path}/control`, "POST", {
        action: "pause",
        position: 0,
        revision: state.revision,
      }),
    ]);
    expect(controls.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (
        await other.post(`${path}/control`, {
          data: { action: "play", revision: state.revision },
        })
      ).status(),
    ).toBe(403);
    await change(other, `${path}/membership`, "DELETE");
    expect((await other.get(path)).status()).toBe(404);
  } finally {
    if (id) await change(request, `/api/rooms/${id}/membership`, "DELETE");
    await other.dispose();
  }
});

test("logout invalidates an already connected room socket", async ({
  page,
}) => {
  await register(page.request, "Session Host");
  const state = await (
    await change(page.request, "/api/rooms", "POST", { name: "Session room" })
  ).json();
  await page.goto(`/rooms/${state.id}`);
  await page.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(
    page.getByText("Live · synchronized", { exact: true }),
  ).toBeVisible();
  // Observe a second read-only socket whose session is invalidated by the same logout.
  await page.evaluate(
    (id) =>
      new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/ws/rooms/${id}`);
        ws.onopen = () => resolve();
        ws.onclose = (event) => {
          (window as unknown as { roomClose: number }).roomClose = event.code;
        };
      }),
    state.id,
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        [1008, 4001].includes(
          (window as unknown as { roomClose?: number }).roomClose ?? 0,
        ),
      ),
    )
    .toBe(false);
  await change(page.request, "/api/auth/logout", "POST");
  await expect
    .poll(() =>
      page.evaluate(() =>
        [1008, 4001].includes(
          (window as unknown as { roomClose?: number }).roomClose ?? 0,
        ),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("link", { name: "Sign in", exact: false }).first(),
  ).toBeVisible();
});
