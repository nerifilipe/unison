// Run against a local Compose stack. Mutates only the disposable job this script creates.
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const base = process.env.UNISON_URL ?? 'http://localhost:3000';
const docker = process.env.DOCKER_BIN ?? 'docker';
let cookie = '';
async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { Cookie: cookie, ...options.headers } });
  const session = response.headers.getSetCookie().find(value => value.startsWith('JSESSIONID='));
  if (session) cookie = session.split(';')[0];
  return response;
}
async function csrf() {
  const value = await (await request('/api/auth/csrf')).json();
  return { [value.headerName]: value.token };
}
async function waitFor(read, accept) {
  const end = Date.now() + 30000;
  do {
    const value = await read();
    if (accept(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 500));
  } while (Date.now() < end);
  throw new Error('Timed out waiting for recovery/cleanup');
}
const account = { email: `unison-e2e-${randomUUID()}@example.test`, password: 'Recovery-test-password-2026', displayName: 'Recovery Test' };
assert.equal((await request('/api/auth/register', { method: 'POST', headers: { ...await csrf(), 'Content-Type': 'application/json' }, body: JSON.stringify(account) })).status, 201);
assert.equal((await request('/api/auth/login', { method: 'POST', headers: await csrf(), body: new URLSearchParams({ email: account.email, password: account.password }) })).status, 204);
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify({ title: 'Lease recovery test', artist: 'Unison tests', genre: 'Other', rightsConfirmed: true, rightsNote: 'Generated invalid test bytes; no recording.' })], { type: 'application/json' }));
form.append('audio', new Blob(['invalid audio test bytes']), 'invalid.wav');
const submitted = await request('/api/uploads', { method: 'POST', headers: await csrf(), body: form });
assert.equal(submitted.status, 202);
const { id } = await submitted.json();
assert.match(id, /^[0-9a-f-]{36}$/);
const read = async () => (await request(`/api/uploads/${id}`)).json();
try {
  await waitFor(read, job => job.status === 'FAILED');
  for (const attempts of [1, 3]) {
    const sql = `UPDATE uploads SET status='PROCESSING',attempts=${attempts},updated_at=now()-interval '11 minutes' WHERE id='${id}' AND status='FAILED';`;
    const result = spawnSync(docker, ['compose', 'exec', '-T', 'db', 'psql', '-U', 'unison', '-d', 'unison', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /UPDATE 1/);
    const job = await waitFor(read, job => job.status === 'FAILED');
    assert.equal(job.attempts, attempts === 1 ? 2 : 3);
    assert.match(job.error, attempts === 1 ? /could not be decoded/ : /interrupted/);
  }
  console.log('Passed: expired processing lease is retried; third interruption becomes a recoverable failure.');
} finally {
  assert.equal((await request(`/api/uploads/${id}`, { method: 'DELETE', headers: await csrf() })).status, 204);
  await waitFor(async () => (await request(`/api/uploads/${id}`)).status, value => value === 404);
  console.log('Passed: test job and its storage objects cleaned up.');
}
