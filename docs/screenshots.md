# README screenshots

The PNG files in `images/` are actual Chromium captures of the local application, not mockups. Desktop captures use 1440 × 1100 and mobile uses 390 × 1000. Images are committed so GitHub can display them without running the app or accessing an external image service.

## Refresh

Start Unison using the [local setup guide](local-setup.md), then:

```sh
cd frontend
npm ci
npx playwright install chromium
node scripts/capture-readme.mjs
```

The script uses `http://localhost:3000` by default; `UNISON_URL` can select another local instance. It overwrites the four PNG files in `docs/images/`. Linux may need `npx playwright install --with-deps chromium`.

The script captures the real catalog, starts a generated track, creates two disposable accounts named Alex and Mia, and creates a populated playlist and room. It removes its own playlist and room afterward. Disposable accounts remain in the local database; existing user accounts and uploads are not modified. No passwords or private permission notes are captured. Catalog metadata from existing public uploads may appear; the recordings themselves are not included in the repository.

Review every image before committing, checking for clipped content, loading/error states and any unintended personal information. The mobile image demonstrates the responsive interface in Chromium emulation, not verification on a physical phone.
