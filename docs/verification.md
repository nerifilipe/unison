# Milestone 1 verification

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
