# Unison verification

## Milestone 3 — 2026-09-10

- **Builds:** Docker Compose rebuild/start succeeded; frontend TypeScript/Vite build passed. Host `mvnw.cmd -B -ntp verify` passed 7 tests: catalog/security contracts and audio stream/duration validation.
- **End-to-end:** `npx playwright test --workers=2` passed **22 tests** across desktop/mobile Chromium, including all prior account/library/player regressions.
- **Real ingestion:** browser form uploads a generated four-second WAV, the live worker converts/publishes it, backend search finds it, S3 serves MP3 byte ranges (206), and the browser plays it with advancing time.
- **Validation/ownership:** missing CSRF (403), false rights declaration, unsupported extension, empty file, oversized file (413), corrupt audio, failed-job retry, overlong search, and another account's read/retry/delete (404) verified. Anonymous access to private originals is denied (403).
- **Lifecycle:** deleting a published upload removes its catalog row, favorite and playlist references, then removes its S3 output and job. Tests remove their generated audio after success.
- **Recovery:** `node scripts/verify-ingestion-recovery.mjs` passed against the running stack. It simulated expired PROCESSING leases on its own disposable job, verified reprocessing at attempt 2 and an actionable failure after attempt 3, then verified deferred cleanup completed. This simulates durable interrupted state; it does not kill a live worker.
- **Mobile correction:** the first mobile run exposed shared form CSS overriding checkbox dimensions. Moving feature CSS after base styles and giving the checkbox explicit scoped dimensions fixed the actual click target; the complete mobile upload flow then passed.

See [ingestion](ingestion.md) for bounds, private/public object policy and operational limits. Test accounts remain disposable local data. Coverage uses Chromium emulation, not physical phones or Safari/Firefox.

## Milestone 2 — 2026-09-09

- **Backend:** `mvnw.cmd -B -ntp verify` passed 4 tests (2 catalog contracts + 2 security boundary tests). The Docker build also ran all 4 successfully.
- **Frontend:** TypeScript/Vite production build passed in the Node 24 container; host build passed as well.
- **End-to-end:** final `npx playwright test` passed **18 tests** across desktop and mobile Chromium profiles, including all milestone 1 regressions.
- **Migration:** Flyway versions 1 and 2 both succeeded on the existing database. The catalog retained its three tracks. Test accounts have stored password hashes, with no password/hash fields in account responses.
- **Authentication:** registration, normalized duplicate-email rejection, weak-password rejection, invalid login, HttpOnly/SameSite cookie attributes, login session-ID rotation, logout and rejection of a copied old cookie verified against the real backend.
- **Authorization:** anonymous library access returns 401; mutations without CSRF return 403. A second account cannot read, rename, delete, add/remove tracks or reorder the first account's playlist (404). Favorites and playlist listings are isolated.
- **Library:** create/edit/delete with cancellation, add/remove/idempotent additions, reordering, duplicate/invalid order rejection, concurrent additions and persistence after reload/relogin passed. Failed favorite writes retain state and can be retried. Temporary library failures recover; an expired session clears private content.
- **Player:** the same audio element continues playing through registration/login and SPA navigation. Existing seek/volume/media-range checks still pass.
- **Visual QA:** inspected desktop/mobile playlist captures; no horizontal overflow. Mobile navigation exposes all four sections and account access. Sidebar scrolling supports shorter desktop windows.

Tests register disposable `unison-e2e-…@example.test` accounts in the local database and send no email. Browser coverage uses Chromium emulation, not physical mobile devices or Safari/Firefox. Password recovery, email verification and production authentication abuse controls remain outside this milestone. See [personal library](personal-library.md).

## Milestone 1 baseline

Verified locally on 2026-09-09, Windows + Docker Desktop/WSL 2.

## Results

| Check | Result |
| --- | --- |
| `docker compose up -d --build` | Passed; PostgreSQL and backend healthy, audio seed exits 0, frontend and storage running |
| Backend Java 21 / Spring Boot 4.1.1 container build | Passed, including 2 MVC contract tests |
| Windows `.\mvnw.cmd -B -ntp verify` | Passed; 2 tests, 0 failures/errors |
| Frontend TypeScript + Vite production build | Passed on host Node 25 and container Node 24.16.0 |
| npm dependency audit during final installation | 0 reported vulnerabilities; not a full security audit |
| PostgreSQL query | Three seeded tracks, stable IDs and 60-second durations |
| PowerShell smoke test after recreating backend | Passed; gateway recovers without a frontend restart, all three WAV objects return HTTP 206 |
| Playwright desktop + mobile Chromium | 10 tests passed |
| Desktop/mobile screenshots | Inspected; responsive layout, no horizontal overflow |

## End-to-end coverage

- Read the real catalog through Nginx → Spring Boot → PostgreSQL.
- Read all three real S3 objects, asserting partial content, content range, audio MIME type and WAV signature.
- Start actual HTML audio, assert advancing time, navigate to About and retain the same audio DOM element while playback continues.
- Seek, adjust volume, pause/resume, navigate back and play another track.
- Show loading; recover from HTTP 503 using Retry.
- Display empty catalog and no search results, then restore the catalog.
- Recover from a failed media request using Retry audio.
- Load `/about` directly through the SPA fallback.

The main playback test does not mock the backend or media. Error/empty/loading tests intercept requests to induce specific states. Mobile coverage uses Chromium device emulation, not a physical phone. Firefox, Safari, real mobile devices and listening through physical speakers have not been verified. Actual audibility depends on the user's device output/volume.

## Issues caught and resolved

- Docker's per-user credential helper required a refreshed PATH in the initial terminal session.
- Dependency installation had to finish before the first frontend Docker build could use its lockfile.
- Updating/recreating the backend exposed stale DNS resolution in Nginx. Named upstreams now use Docker DNS with a five-second refresh and valid Host headers. Verified by recreating only the backend and repeating the smoke check.
- An offscreen skip link appeared in a mobile full-page capture. It is now clipped until focused.

## Repeat

Run the commands in the root README. Screenshots and HTML reports are generated under `frontend/test-results/` and `frontend/playwright-report/` (ignored by Git). `scripts/smoke.ps1` provides the quick API/media check.
