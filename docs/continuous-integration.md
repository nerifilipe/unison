# Continuous integration

`.github/workflows/ci.yml` runs on pushes, pull requests and manual dispatch. It uses GitHub-hosted Ubuntu 24.04 runners with read-only repository permissions and no deployment credentials. A newer run on the same ref cancels its predecessor.

| Check            | What it verifies                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Frontend build   | Node 24.16.0, `npm ci`, TypeScript checks and Vite production build                                                             |
| Backend tests    | Temurin Java 21, committed Maven Wrapper, `verify` and JUnit reports                                                            |
| Full-stack tests | Actual Docker images, PostgreSQL migrations, generated audio, MinIO, FFmpeg, Nginx, HTTP byte ranges, desktop/mobile Playwright |

The two build checks run independently. Full-stack tests start only after both pass, using the same Compose configuration as local development. The backend Docker build also runs Maven verification, ensuring the shipped image passes its tests. CI installs Chromium and its Linux dependencies from the locked Playwright package. Two workers bound CPU/memory usage; the existing CI retry policy allows one retry and rejects committed `test.only` calls.

Each integration job owns an isolated `unison-ci` Compose project on a fresh runner. The `infra/compose.ci.yaml` override exposes only the frontend on port 13000, with matching WebSocket origins; database, backend and storage stay inside its Docker network. This requires Compose 2.24.4+ for port replacement. It waits for container readiness and then probes the HTTP gateway. Generated sample audio is the only initial catalog content; browser upload tests create their own authorized signals. No cloud storage, music account or production secret is required. Cleanup removes only that job's disposable containers and volumes. Do not run the workflow's volume-deleting cleanup against your local `unison` project.

## Reports and failures

Open the run under the repository's **Actions → CI** tab. Download `backend-test-reports` for Maven test output or `full-stack-test-results` for the Playwright HTML report, screenshots/traces, image build log and service logs. Reports are retained for seven days. Diagnostic collection and cleanup are attempted even after a failed step. Hard runner termination can prevent these final steps from executing.

To inspect a downloaded Playwright report, extract it and run `npx playwright show-report <path-to-playwright-report>` from `frontend/`. Test data and authentication sessions are disposable; traces may contain those test session details.

For local reproduction, follow the README's Verify section. The workflow deliberately does not deploy, publish images, modify branch protection or push commits. After committing and pushing this change, GitHub will execute the workflow; a successful local check is not evidence of a successful hosted run. If desired, require **Frontend build**, **Backend tests** and **Full-stack tests** in the repository's branch rules after the first hosted run.

Dependabot checks GitHub Actions versions weekly. Node matches the frontend Docker image; update both together when changing its version.

## Reproduce with a fresh stack

From the repository root (Compose 2.24.4+):

```sh
docker compose -p unison-ci -f compose.yaml -f infra/compose.ci.yaml up -d --build --wait --wait-timeout 180
cd frontend
npm ci
npx playwright install --with-deps chromium
CI=true UNISON_URL=http://localhost:13000 npx playwright test --workers=2
```

In PowerShell, use `$env:CI='true'; $env:UNISON_URL='http://localhost:13000'; npx playwright test --workers=2` for the last line. These environment variables affect only that terminal session. Close it or remove the variables before testing the regular app again.

After testing, return to the repository root and remove the disposable CI stack:

```sh
docker compose -p unison-ci -f compose.yaml -f infra/compose.ci.yaml down --volumes --remove-orphans
```

The explicit project name and override are required for both commands. They keep the normal app on port 3000 and its volumes separate.

References: [Playwright CI](https://playwright.dev/docs/ci), [Docker Compose readiness](https://docs.docker.com/reference/cli/docker/compose/up/), [GitHub artifact action](https://github.com/actions/upload-artifact).
