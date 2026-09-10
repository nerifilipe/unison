# Install and run Unison locally

Each person runs an independent copy on their own computer. No cloud service, subscription, Supabase project, Docker login or music-service account is needed. PostgreSQL and MinIO store data in local Docker volumes. A fresh installation includes three original generated tracks; another person's accounts, playlists and uploaded songs are not copied with the code.

## 1. Prerequisites

- Install Git.
- **Windows:** install Docker Desktop with the WSL 2 backend and Linux containers. Complete any WSL setup requested by the installer and restart Windows if prompted. Start Docker Desktop and wait until the engine is running.
- **macOS:** install Docker Desktop for your processor (Apple silicon or Intel), then start it.
- **Linux:** install Docker Engine and its Docker Compose v2 plugin. Start the engine and ensure your user can run `docker info`. The shell scripts also require `curl`.

Use a current Compose v2 with `up --wait` support. Java, Node.js, Maven, PostgreSQL, MinIO and FFmpeg run inside containers; no separate host installations are needed. An editor is optional.

The initial build needs internet access to download container images and dependencies. Allow several GB of disk space; usage grows with uploads and Docker caches. The exact size depends on your platform and existing installation. Check Docker's usage with `docker system df`. Ports 3000, 5432, 8080, 9000 and 9001 must be available.

## 2. Download

Open PowerShell on Windows or Terminal on macOS/Linux:

```sh
git clone https://github.com/nerifilipe/unison.git
cd unison
```

Alternatively, extract the repository ZIP and open a terminal in the extracted folder containing `compose.yaml`.

## 3. Start

**Windows (PowerShell):**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local.ps1 start
```

`-ExecutionPolicy Bypass` applies only to this process; it does not change the saved machine policy. The script recognizes Docker Desktop's default Windows per-user location if Docker is missing from PATH. If your organization blocks scripts, use the direct Docker commands below.

**macOS / Linux:**

```sh
sh scripts/local.sh start
```

Startup builds the application, starts dependencies, waits for readiness, and checks the web page, backend catalog and partial audio downloads. The first build can take several minutes. A failed command stops the script rather than reporting success. Containers remain available for diagnosis if verification fails.

Open **http://localhost:3000** when the script reports that Unison is ready.

### Direct Docker alternative (all platforms)

From the repository root:

```sh
docker compose up -d --build --wait --wait-timeout 180
docker compose ps -a
```

This starts the same application without the helper script's HTTP/audio checks. `audio-seed` is a one-shot initialization job: `Exited (0)` is normal.

## 4. Try it

1. Play First Light, Slow Orbit or Tidal in Discover. Navigate to another page and confirm playback continues. Your browser requires a click before audio starts.
2. Create your own account through **Sign in → Create account**. There is no predefined application login; registration does not send email.
3. Save a favorite and create a playlist in **Your library**.
4. Optionally upload a recording you have permission to distribute.
5. To test rooms, create one and open its invitation in an incognito window on the same computer. Register another account, join and enable room audio.

`localhost` refers to the computer opening the link. Separate installations do not share accounts, songs or rooms. Inviting someone on another computer requires separate network/deployment configuration; this setup exposes ports only on loopback.

## Everyday commands

Run these from the repository root. Scripts also work from another directory when called by their full path.

| Action | Windows PowerShell | macOS / Linux |
| --- | --- | --- |
| Start / rebuild | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local.ps1 start` | `sh scripts/local.sh start` |
| Stop and preserve data | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local.ps1 stop` | `sh scripts/local.sh stop` |
| Service status | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local.ps1 status` | `sh scripts/local.sh status` |
| Recent logs | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local.ps1 logs` | `sh scripts/local.sh logs` |
| Verify UI / API / audio | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local.ps1 verify` | `sh scripts/local.sh verify` |

Stopping preserves accounts, favorites, playlists and uploads. Restarting the backend ends rooms and sessions; sign in again. To update a Git checkout, run `git pull` with a clean working tree, then run `start`. Database migrations run automatically.

Data lives in the `unison_postgres-data` and `unison_audio-data` Docker volumes, outside the repository. Deleting the repository does not back up or remove those volumes. `docker compose down` removes containers but preserves volumes. **Do not use `docker compose down -v` unless you intend to delete all local accounts and audio.** Docker Desktop factory resets can also remove data. These scripts never reset or delete volumes.

## Troubleshooting

- **Docker not found:** reopen the terminal after installation; check Docker's installation and PATH.
- **Cannot connect / permission denied:** start Docker Desktop or Docker Engine. On Linux, configure user access according to Docker's installation instructions. On Windows, finish WSL setup and any requested reboot.
- **Unknown `--wait` option:** update Docker Desktop or the Compose v2 plugin.
- **Port already allocated:** stop the conflicting program and rerun `start`. Changing ports also requires updating associated URLs and room origins.
- **Download/build failure:** check internet access and the error output, then rerun `start`; successful build layers are reused.
- **Readiness timeout:** inspect `status` and `logs`, resolve the reported error, and retry. On a slow computer, use the direct command with `--wait-timeout 600`.
- **No sound:** click Play, check browser/device volume, and run `verify`. The smoke check verifies delivery, not your speakers. Room listeners must click **Enable room audio**.

For optional host development and the full browser test suite, see the [README](../README.md). The helper scripts require no host Node or Java.
