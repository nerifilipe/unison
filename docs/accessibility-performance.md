# Accessibility and loading review

## Scope

The review covers Discover, search/error/empty states, About, account forms, favorites, playlists, uploads, credits/playlist dialogs, listening-room entry and active room controls. Automated checks use axe-core through Playwright, with no disabled rules or excluded page regions. Results include inconclusive findings for manual review; zero automated violations is not a WCAG certification.

Keyboard checks cover the skip link, route focus, named dialogs, Escape and restoration of the trigger's focus. Native modal dialogs make the background inert; Chromium may still allow focus to its own browser chrome. Route changes focus the main landmark and update the browser title without remounting audio. Labels and password guidance are associated with inputs; seek/volume controls expose readable values. Lists use a consistent heading hierarchy, including empty states, and room landmarks have distinct names.

The mobile private-page review uses a 320 CSS-pixel viewport, with horizontal overflow assertions. Text fields use 16px text on small screens and native sliders have a larger pointer area. A dark overlay behind cover text keeps it readable over the brightest artwork. Existing focus outlines and reduced-motion preferences remain supported.

## Loading changes and budgets

Nginx compresses JavaScript/CSS in `/assets/` and marks fingerprinted assets immutable for one year. HTML must revalidate, so returning visitors obtain current asset names. Missing asset URLs return 404 rather than the SPA shell; errors are not marked immutable. Authentication responses retain their no-store policy. Audio byte ranges and WebSocket traffic do not use the static asset rules.

A local cold Chromium measurement at 320px recorded:

| Resource              | Uncompressed bytes | Transferred body bytes |
| --------------------- | -----------------: | ---------------------: |
| JavaScript            |            287,237 |                 90,654 |
| CSS                   |             31,222 |                  7,509 |
| Four WOFF2 font files |             56,296 |                 56,296 |
| Total static assets   |            374,755 |                154,459 |

JavaScript transfer is about 68% smaller than its uncompressed response. These are body sizes, excluding HTTP headers; minor content edits change exact values. This local measurement does not claim production Core Web Vitals or a Lighthouse score. There is no initial audio request before an explicit play action.

`tests/performance.spec.ts` enforces cold-load budgets of 120 KiB for encoded JavaScript and 250 KiB for all encoded static assets. It also verifies compression/cache headers, missing-asset handling, private response cache policy and deferred audio. `tests/accessibility.spec.ts` adds semantic/contrast scans and keyboard regression checks. Both run in the existing CI browser job and attach findings to the Playwright report.

## Repeat and remaining coverage

With the Docker app running, from `frontend/`:

```sh
npx playwright test accessibility.spec.ts performance.spec.ts --workers=2
npx playwright test --workers=2
```

Use the CI Compose override and `UNISON_URL=http://localhost:13000` for isolated data, as described in [continuous integration](continuous-integration.md). Test accounts are disposable; public user uploads are not modified.

Physical devices, Safari/Firefox and a manual screen-reader session with NVDA or VoiceOver remain unverified. Production latency, CDN caching and field performance must be measured after deployment. See [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) and the Nginx [gzip](https://nginx.org/en/docs/http/ngx_http_gzip_module.html) and [cache-header](https://nginx.org/en/docs/http/ngx_http_headers_module.html) documentation.
