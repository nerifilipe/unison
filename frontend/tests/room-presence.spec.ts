import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("server pauses a room when host stops pinging even while broadcasts continue", async ({
  page,
}) => {
  test.setTimeout(50000);
  const csrf = async () => {
    const token = await (await page.request.get("/api/auth/csrf")).json();
    return { [token.headerName]: token.token };
  };
  const account = {
    email: `unison-e2e-${randomUUID()}@example.test`,
    password: "Presence-test-password-2026",
    displayName: "Presence test",
  };
  expect(
    (
      await page.request.post("/api/auth/register", {
        headers: await csrf(),
        data: account,
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await page.request.post("/api/auth/login", {
        headers: await csrf(),
        form: { email: account.email, password: account.password },
      })
    ).status(),
  ).toBe(204);
  const created = await page.request.post("/api/rooms", {
    headers: await csrf(),
    data: { name: "Presence test" },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  try {
    const queued = await (
      await page.request.post(`/api/rooms/${id}/queue`, {
        headers: await csrf(),
        data: { trackId: "first-light" },
      })
    ).json();
    expect(
      (
        await page.request.post(`/api/rooms/${id}/control`, {
          headers: await csrf(),
          data: { action: "play", position: 0, revision: queued.revision },
        })
      ).status(),
    ).toBe(200);
    await page.goto("/about");
    await page.evaluate((id) => {
      const ws = new WebSocket(`ws://${location.host}/ws/rooms/${id}`);
      ws.onmessage = (event) => {
        (
          window as unknown as {
            presenceState: { playing: boolean; position: number };
          }
        ).presenceState = JSON.parse(event.data).state;
      };
    }, id);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { presenceState?: { playing: boolean } })
              .presenceState?.playing,
        ),
      )
      .toBe(true);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { presenceState?: { playing: boolean } })
                .presenceState?.playing,
          ),
        { timeout: 35000, intervals: [1000] },
      )
      .toBe(false);
    const state = await (await page.request.get(`/api/rooms/${id}`)).json();
    expect(state.position).toBeGreaterThanOrEqual(30);
    expect(state.position).toBeLessThan(34);
  } finally {
    await page.request.delete(`/api/rooms/${id}/membership`, {
      headers: await csrf(),
    });
  }
});
