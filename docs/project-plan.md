# Unison project plan

## Repository inspection — 2026-09-09

The repository initially contains a short README, MIT license, Java-oriented gitignore, and untracked local tool archives. There is no existing application, test suite, hosting configuration, or architecture graph to preserve. Local tool archives are not project dependencies.

## Product and architecture

Unison is a music web application for a Computer Engineering portfolio. Product copy and primary documentation are in English. React, TypeScript and Vite provide the frontend; Java 21 and Spring Boot provide a modular monolith; PostgreSQL stores metadata. S3-compatible storage holds audio and FFmpeg generates/processes demo assets. Future listening rooms use WebSockets with server-authoritative host state.

Directories: `frontend/`, `backend/`, `infra/`, `docs/`, `scripts/`. Backend packages group features, starting with `catalog`; cross-cutting health support comes from Actuator. HTTP DTOs keep database entities private. Flyway owns schema and deterministic catalog seeding.

## Milestones

1. **Local foundation (current scope):** Docker Compose, database migrations, generated authorized demo audio in local S3 storage, backend catalog API, loading/empty/error states, persistent player, client-side navigation, automated end-to-end checks and run instructions.
2. **Personal library:** accounts, authentication, favorites and playlists; authorization and ownership tests.
3. **Catalog ingestion:** authenticated uploads, validation, FFmpeg processing jobs, storage lifecycle and catalog search.
4. **Listening rooms:** WebSockets, host controls, shared queue, votes, reconnect/synchronization protocol and concurrency tests.
5. **Portfolio release:** accessibility and performance review, CI, deployment, observability and architecture documentation.

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
