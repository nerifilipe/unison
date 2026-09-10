# Unison project plan

## Repository inspection — 2026-09-09

The repository initially contains a short README, MIT license, Java-oriented gitignore, and untracked local tool archives. There is no existing application, test suite, hosting configuration, or architecture graph to preserve. Local tool archives are not project dependencies.

## Product and architecture

Unison is a music web application for a Computer Engineering portfolio. Product copy and primary documentation are in English. React, TypeScript and Vite provide the frontend; Java 21 and Spring Boot provide a modular monolith; PostgreSQL stores metadata. S3-compatible storage holds audio and FFmpeg generates/processes demo assets. Future listening rooms use WebSockets with server-authoritative host state.

Directories: `frontend/`, `backend/`, `infra/`, `docs/`, `scripts/`. Backend packages group features, starting with `catalog`; cross-cutting health support comes from Actuator. HTTP DTOs keep database entities private. Flyway owns schema and deterministic catalog seeding.

## Milestones

1. **Local foundation (completed):** Docker Compose, database migrations, generated authorized demo audio in local S3 storage, backend catalog API, loading/empty/error states, persistent player, client-side navigation, automated end-to-end checks and run instructions.
2. **Personal library (completed):** accounts, authentication, favorites and playlists; authorization and ownership tests.
3. **Catalog ingestion (completed):** authenticated uploads, validation, FFmpeg processing jobs, storage lifecycle and catalog search.
4. **Listening rooms (completed):** WebSockets, host controls, shared queue, votes, reconnect/synchronization protocol and concurrency tests.
5. **Portfolio release:** accessibility and performance review, CI, deployment, observability and architecture documentation.

## Milestone 5 — accessibility and loading review

Review keyboard navigation, dialogs, heading hierarchy, form semantics, contrast, 320px reflow and initial network cost. Add accessibility and asset-budget checks to the browser suite. Preserve playback/navigation and protect dynamic responses from static caching. Record measurements and manual coverage limits in `accessibility-performance.md`; deployment remains subsequent work.

Implemented and locally verified: production build passed; all 38 browser tests passed, followed by a focused accessibility/performance rerun covering the final empty-state headings. Automated scans reported no violations in the covered states, and the measured initial JavaScript transfer was about 68% smaller with gzip. Manual screen-reader and physical-device verification remain open and are explicitly documented.

## Milestone 5 — CI foundation

Add GitHub Actions checks for frontend compilation, backend verification and full-stack Playwright execution against a fresh Docker Compose environment. Include readiness checks, bounded execution, dependency caches, diagnostic artifacts and disposable resource cleanup. Document local reproduction and hosted-run verification. Deployment, broader accessibility/performance review and branch-rule configuration remain subsequent work.

Implemented on 2026-09-10. Workflow validation with actionlint passed, the frontend production build passed, Maven verified 11 backend tests, and all 30 Playwright tests passed with CI settings against newly created `unison-ci` volumes on port 13000. The ordinary local app and its data were preserved. Hosted GitHub execution remains to be confirmed after this workflow is committed and pushed. See `continuous-integration.md` for checks, artifacts and reproduction commands.

## Frontend refinement — 2026-09-10

Before milestone 5, redesign the complete interface around music and everyday actions: neutral charcoal surfaces, a restrained lavender accent, clear typography, compact navigation and consistent controls across Discover, accounts, library, uploads, rooms and the persistent player. Replace development badges, milestone labels, fictitious cover branding and infrastructure-oriented product copy. The spotlight uses actual backend catalog metadata; search remains server-backed.

The user explicitly chose to keep the three generated sample tracks and existing uploads. No catalog, account or library data is removed. Automated tests and technical documentation remain part of the repository. Verify desktop/mobile layouts and the existing end-to-end playback, library, ingestion and room flows before delivery.

## Milestone 1 acceptance criteria

- A fresh checkout starts with documented Docker Compose commands; no cloud accounts or host Maven required.
- Catalog data comes from Spring Boot and PostgreSQL, not a frontend fixture.
- Synthetic audio is generated reproducibly and served from S3-compatible local storage with byte-range support.
- Play/pause, seek and volume work. The same audio element keeps playing across Discover and About routes.
- Loading, API failure with retry, empty catalog and media failure are visible and accessible.
- Verify real API, database, storage, HTTP range requests and browser playback/navigation; test failure states separately.
- No accounts, uploads, favorites, playlist management or rooms in this milestone.

## Decisions and boundaries

- Use Docker Compose as the reproducible baseline; optional Vite development runs on the host.
- MinIO provides local S3 compatibility. A one-shot seed service generates three original test signals with FFmpeg, uploads them and enables read-only public access to the demo bucket. No third-party recordings are included.
- A same-origin Nginx gateway serves the frontend and proxies API/media requests. Storage credentials remain outside frontend code.
- Demo credentials and HTTP bindings are local-development defaults; production authentication, TLS, restricted storage policies and secrets are later deployment work.
- Playback persists during SPA navigation, not full reloads. Browsers require a user gesture to start audio.

## Milestone 1 delivery

Implemented with Spring Boot 4.1.1, Java 21, React 19, TypeScript, Vite 7, PostgreSQL 17 and MinIO. The frontend includes Discover, About, a local filter over backend results and a persistent player; later product features remain unimplemented. FFmpeg generates three one-minute synthetic audio assets. See `verification.md` for acceptance evidence and `../README.md` for startup, development and test commands.

## Milestone 2 acceptance criteria

- Register with display name, normalized unique email and a validated password stored as a BCrypt hash; sign in/out using server sessions and HttpOnly cookies.
- Protect every mutation, including login and registration, with CSRF tokens. Rotate session identifiers at login; invalidate the session on logout. Never store passwords or auth tokens in browser local storage.
- Keep discovery public; show clear sign-in prompts for personal features.
- Persist favorites and private playlists in PostgreSQL. Support playlist creation, renaming, description, deletion, adding/removing tracks and reordering.
- Enforce ownership in backend queries and lock a playlist while changing its contents. Return 404 for another account's playlist.
- Preserve music across authentication and library navigation. Provide loading, empty, validation and recoverable failure states.
- Verify isolated accounts, missing CSRF, expired/logged-out sessions, persistence after reload, duplicate registration and playlist/favorite flows alongside milestone 1 regressions.
- Password reset, email verification, social login, public sharing, uploads and listening rooms remain later work. Local sessions expire after 30 minutes idle and on backend restart.

## Milestone 2 delivery

Completed on 2026-09-09. Added Spring Security session authentication with CSRF and BCrypt, account-scoped favorites, and private playlist CRUD/membership/ordering. The responsive interface provides account, library and favorites pages without remounting the player. Flyway upgrades the existing database. Validation: 4 backend tests and 18 desktop/mobile end-to-end tests passed; see `verification.md`.

## Milestone 3 acceptance criteria

- Authenticated, CSRF-protected multipart upload with title, artist, genre and an explicit distribution-rights declaration/provenance note.
- Limit files to 25 MiB and WAV/MP3/FLAC/OGG; verify actual audio with ffprobe, require one audio-only stream and 1–600 seconds. File extensions/MIME types alone are not trusted.
- Store originals privately in S3; persist jobs in PostgreSQL, process outside the HTTP request and publish only validated MP3 output. Bound process time and restrict FFmpeg to local files and supported demuxers.
- Show upload/job status, errors, retry and owner-only removal. Recover abandoned work on restart through leases; retry pending storage cleanup. Published uploads are intentionally public catalog entries.
- Remove successful originals, remove both objects when deleting, and hide a removed track from the catalog/library through cascading references.
- Search titles, artists and genres through a bounded backend query; debounce/cancel frontend searches. Existing player and account/library behavior must remain intact.
- Validate with generated authorized test audio, real S3/FFmpeg/database integration, invalid payloads, permissions and existing regression tests. No rooms in this milestone.

## Milestone 3 delivery

Completed on 2026-09-10. Added the ingestion module, V3 migration, private source storage, a durable processing/cleanup queue, bounded FFmpeg conversion and authenticated upload/retry/removal UI. Catalog search now queries the backend. Validation: 7 backend tests, 22 desktop/mobile end-to-end tests, and an independent expired-lease recovery check passed. Documentation includes API, lifecycle and remaining operational limits in `ingestion.md`. Listening rooms are the next milestone.

## Milestone 4 acceptance criteria

- Add explicit public credits to uploads, editable by their owner and visible from catalog/library/player. Keep existing private provenance notes private; do not infer licenses or publish them automatically.
- Signed-in users create unlisted rooms and join via an invitation link. The creator is the host; leaving as host ends the room. Other members can leave and rejoin.
- Host controls play/pause/seek/skip. Members add catalog tracks and cast at most one vote per queue entry; votes rank the next track with stable insertion-order ties. Serialize room changes and reject stale host commands.
- Send authoritative snapshots over authenticated, origin-restricted WebSockets; use CSRF-protected HTTP mutations. Recheck session validity and room membership while connected.
- Keep one persistent audio element across navigation, estimate server clock offset, correct drift, handle autoplay permission explicitly, pause on disconnection, and resynchronize after reconnect. Ordinary catalog play cannot silently override room playback.
- Advance the queue on the server when a track ends. Pause after 30 seconds without the host; expire inactive rooms after 30 minutes. Bound rooms/members/queues/connections.
- Rooms are ephemeral, single-backend-instance state for this milestone. A backend restart ends rooms; accounts, uploads and libraries remain durable. Document this boundary.
- Verify two independent browsers, host/member authorization, votes and concurrent commands, reconnect, room end, session invalidation, mobile layout and prior regressions using generated demo audio.

## Milestone 4 delivery

Completed on 2026-09-10. Added unlisted authenticated listening rooms with server-authoritative playback, shared queues, vote ordering, host controls, WebSocket snapshots/clock estimation, reconnect/reload recovery and host-away pause. The existing audio element remains persistent during navigation. V4 adds separate public credits, editable by upload owners and visible through track information dialogs; existing private notes remain private. Docker builds and 11 backend tests passed. All 30 desktop/mobile end-to-end tests passed, including real playback in independent sessions, a guest clock offset by two minutes, stale command conflicts, hostile origins, logout invalidation and live host-presence timeout. See `listening-rooms.md` and `verification.md`. Rooms intentionally remain ephemeral and limited to one backend instance. Portfolio release work is next.
