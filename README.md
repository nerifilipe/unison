# Unison

A little space to get lost in sound. A music web application for a Computer Engineering portfolio.

**Milestones 1–2:** backend-driven catalog, original synthetic demo audio, a persistent player, email/password accounts, favorites and private playlists. Includes play/pause, seek, volume, local catalog filtering, playlist editing/ordering and recoverable error states. Uploads and synchronized rooms are future milestones.

## Run locally

Prerequisites: Git and Docker Desktop running Linux containers (WSL 2 on Windows), or Docker Engine with Compose on Linux. The first build needs internet access and several minutes to download dependencies. Java, Node, Maven, PostgreSQL and FFmpeg do **not** need host installations for this path.

From the repository root:

```sh
docker compose up -d --build
```

Open **http://localhost:3000**. Click **Start listening**, navigate to **About Unison**, and confirm the player keeps playing. Audio starts only after a user gesture. Generated audio is deliberately simple ambient chords, not commercial music.

To try the personal library, select **Sign in → Create account**, choose a display name, email and password (10–64 characters), then create a playlist in **Your library**. In **Discover**, use the heart to save a favorite and the list-plus button to add a track to a playlist. Open the playlist to rename it, edit its description, reorder/remove tracks or delete it. Use **Your account → Sign out** to end the session. Registration does not send email; verification and password recovery are not implemented yet.

Existing milestone 1 installations upgrade with the same startup command. Flyway adds the account/library tables without deleting existing catalog data or audio. Sessions expire after 30 minutes idle or when the backend restarts; sign in again to restore access to persisted favorites/playlists.

```sh
docker compose ps -a
docker compose logs --tail=80 backend audio-seed frontend
docker compose down
```

`audio-seed` exiting with code 0 is expected. Database and audio persist in named volumes when stopped with `down`. `docker compose down -v` deletes the local database and audio volumes; use only for an intentional clean reset, then run the startup command again.

### Local endpoints

| Service | URL | Purpose |
| --- | --- | --- |
| App | http://localhost:3000 | Same-origin UI, API and media gateway |
| Catalog API | http://localhost:8080/api/tracks | Metadata from PostgreSQL |
| Health | http://localhost:8080/actuator/health | Backend/database readiness |
| S3 API | http://localhost:9000 | Local audio object storage |
| Storage console | http://localhost:9001 | Inspect generated audio |
| PostgreSQL | localhost:5432 | Database `unison` |

Local demo credentials are in `compose.yaml`: PostgreSQL `unison` / `unison-local`; MinIO `unison-local` / `unison-local-storage`. All published ports bind to loopback. These are development defaults, not production secrets. Docker login and cloud accounts are unnecessary.

## Develop

Frontend: Node **24 LTS** recommended (the existing Node 25 host also builds the app). The Docker build uses Node 24. Install from the committed lockfile:

```sh
cd frontend
npm ci
npm run dev
```

Open the Vite URL printed in the terminal (normally http://127.0.0.1:5173). Vite proxies `/api` to port 8080 and `/media` to local S3 port 9000; keep the Compose services running. Fonts and artwork are bundled/local.

Backend: Java **21 JDK**, with the included Maven Wrapper (Maven downloads on first use). Stop only the container backend to free port 8080, leaving database/storage up:

```sh
docker compose stop backend
cd backend
sh mvnw spring-boot:run
```

On Windows use `.\mvnw.cmd spring-boot:run`. Use the Vite dev server for this host-backend workflow, since the container gateway resolves the Compose backend. Stop the host process and run `docker compose up -d backend frontend` to return to the container workflow.

## Verify

The backend Docker build runs its MVC contract and security boundary tests through `mvn verify`. Separately: `cd backend` then `sh mvnw verify` (Windows: `.\mvnw.cmd verify`).

With the Compose stack running:

```sh
cd frontend
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
```

On Linux, Playwright may require `npx playwright install --with-deps chromium`. The suite runs desktop and mobile Chromium profiles, checks all three media objects and HTTP byte ranges, plays real audio, verifies audio element identity and advancing playback across routes, seeks, changes volume, switches tracks and exercises catalog/media failure recovery. Failure-state tests intercept requests; the main playback test uses the real backend and storage. Screenshots/traces: `frontend/test-results/`; HTML report: `frontend/playwright-report/`.

The library suite also registers unique `unison-e2e-…@example.test` accounts, verifies CSRF protection and ownership using independent sessions, and exercises favorites and playlist management in the browser. It leaves these disposable accounts in the local database. It does not use your own account or contact any email service.

## Structure

```text
frontend/   React, TypeScript, Vite, Playwright
backend/    Java 21, Spring Boot; catalog, identity, library and shared modules
infra/      Nginx gateway and FFmpeg/audio seed container
docs/       Project plan, audio provenance, architecture and verification notes
scripts/    Original demo-audio generator and local smoke check
```

See [project plan](docs/project-plan.md), [architecture](docs/architecture.md), [audio provenance](docs/audio-provenance.md) and [verification](docs/verification.md).

Account/session behavior and the personal library API are documented in [personal library](docs/personal-library.md).

## Troubleshooting

- **Docker command/helper not found:** reopen the terminal after installation. The Windows per-user install is normally `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin`; it must be on PATH.
- **Cannot connect to Docker:** open Docker Desktop and wait for the engine. Restart Windows if WSL activation requested it.
- **Port already in use:** stop the conflicting service or change the loopback port mapping in `compose.yaml` (and Vite proxy targets for API/storage changes).
- **Catalog fails:** inspect `docker compose logs backend db`; the backend waits for PostgreSQL and validates the Flyway schema.
- **Audio fails:** inspect `docker compose logs audio-seed storage`. Rerun `docker compose run --rm audio-seed` to restore storage contents from the built seed image; it is safe to repeat.
- **Database credentials changed:** PostgreSQL initialization variables only apply to a new volume. Use the original credentials or deliberately reset the demo volumes.

## License

Application code and generated demo audio: [MIT](LICENSE). Dependencies retain their own licenses, including the bundled fonts. No third-party music recordings are distributed.
