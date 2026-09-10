import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Uses the real local app. Disposable accounts remain; created playlists/rooms are removed.
const baseURL = process.env.UNISON_URL ?? 'http://localhost:3000';
const output = fileURLToPath(new URL('../../docs/images/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const guestContext = await browser.newContext({ baseURL });
const page = await context.newPage();
let playlistId;
let roomId;

async function mutate(request, path, method, data, form = false) {
  const csrf = await (await request.get('/api/auth/csrf')).json();
  const response = await request.fetch(path, {
    method, headers: { [csrf.headerName]: csrf.token },
    ...(data ? (form ? { form: data } : { data }) : {}),
  });
  if (!response.ok()) throw new Error(`${method} ${path}: ${response.status()}`);
  return response;
}
async function register(request, displayName) {
  const credentials = { email: `unison-screenshot-${randomUUID()}@example.test`, password: randomUUID() };
  await mutate(request, '/api/auth/register', 'POST', { ...credentials, displayName });
  await mutate(request, '/api/auth/login', 'POST', credentials, true);
}
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByText(/Loading audio/)).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(1430, 0);
  await page.screenshot({ path: `${output}/${name}.png`, animations: 'disabled' });
  console.log(`Captured ${name}.png`);
}
try {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play First Light', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await capture('discover');

  await page.setViewportSize({ width: 390, height: 1000 });
  await capture('mobile');
  await page.setViewportSize({ width: 1440, height: 1100 });

  await register(page.request, 'Alex');
  const playlist = await (await mutate(page.request, '/api/library/playlists', 'POST', {
    name: 'Quiet hours', description: 'A slower pace. Ambient textures for reading, thinking and unwinding.',
  })).json();
  playlistId = playlist.id;
  for (const id of ['first-light', 'slow-orbit', 'tidal']) {
    await mutate(page.request, `/api/library/playlists/${playlistId}/tracks/${id}`, 'PUT');
  }
  await page.goto(`/library/${playlistId}`);
  await page.getByRole('button', { name: 'Play First Light', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await capture('playlist');

  await page.goto('/rooms');
  await page.getByLabel('Room name', { exact: true }).fill('After hours');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]+$/);
  roomId = page.url().split('/').pop();
  await register(guestContext.request, 'Mia');
  const guest = await guestContext.newPage();
  await guest.goto(`/rooms/${roomId}`);
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.locator('.room-members')).toContainText('Mia');
  for (const title of ['First Light', 'Slow Orbit', 'Tidal']) {
    await page.getByRole('button', { name: `Queue ${title}`, exact: true }).click();
  }
  await expect(page.getByText('Live · synchronized', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play room', exact: true }).click();
  await page.getByRole('button', { name: 'Enable room audio', exact: true }).click();
  await guest.getByRole('button', { name: 'Enable room audio', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.paused)).toBe(false);
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await capture('room');
} finally {
  try {
    if (roomId) await mutate(page.request, `/api/rooms/${roomId}/membership`, 'DELETE');
    if (playlistId) await mutate(page.request, `/api/library/playlists/${playlistId}`, 'DELETE');
  } finally { await browser.close(); }
}
