# Personal library — milestone 2

## Scope and user flow

Anyone can explore the catalog and play demo audio. A local account is required to save favorites or manage private playlists. Register under **Sign in → Create account**, or sign in to an existing account. Successful registration signs in through the same authentication endpoint; if the follow-up login fails, the UI explains that the account was created and offers sign-in.

Use the heart beside a track to save/remove a favorite. Create a playlist in **Your library**, add tracks through the picker in Discover or Favorites, and open the playlist to edit metadata, move tracks up/down or remove them. Deletion requires a separate confirmation in the UI. Removing a track or playlist does not delete catalog audio or stop the currently playing track.

## Backend modules

- `identity`: account registration, normalized email lookup, BCrypt password hashing and Spring Security configuration. Spring's form-login filter authenticates and persists the security context. The authenticated principal name is the account UUID, never a client-supplied owner ID.
- `library`: parameterized JDBC queries for favorites, playlist metadata and membership. Every playlist lookup/mutation includes the authenticated owner. A missing or foreign playlist returns the same 404. Playlist mutations lock the parent row before updating membership/order. Foreign keys enforce valid accounts and catalog tracks; composite primary keys reject duplicate memberships. PUT additions are idempotent.
- `catalog`: existing JPA catalog plus a public `CatalogReader` boundary for track existence and ordered DTO retrieval. Library code does not access catalog entities/repositories directly. Cross-module foreign keys deliberately share the monolith's database.
- `shared`: validation/status error responses. API errors expose a user-facing message, not SQL or password hashes.

Flyway `V2__personal_library.sql` adds four tables and preserves milestone 1 data. Playlist ordering accepts an exact permutation of current track IDs; stale, partial or duplicate lists return 409. New tracks append after the current maximum position. Concurrent add/reorder operations serialize on the playlist row.

## Authentication and local security

Passwords are validated (10–64 characters and at most 72 UTF-8 bytes), hashed with BCrypt cost 12 and never returned by the API. Emails are trimmed and lowercased before validation/uniqueness checks. Display names are 1–60 characters; playlist names are 1–80; descriptions are at most 500.

Authentication uses server-side sessions with an HttpOnly, SameSite=Lax `JSESSIONID` cookie. Login changes the session ID; logout invalidates the session and deletes the cookie. Sessions expire after 30 minutes idle and do not survive a backend restart. Account/library data remains in PostgreSQL. The frontend keeps account state in memory and clears private content on library API 401 responses. There are no JWTs, passwords or session tokens in localStorage.

All unsafe API requests require a CSRF token, including register, login and logout. The frontend fetches a fresh token from `/api/auth/csrf` before each mutation, which also handles token rotation after login/logout. Requests share the application's origin through Nginx or Vite. Do not disable CSRF to work around a 403.

This remains a loopback-bound local demo. Secure cookies are off for local HTTP; a future HTTPS deployment must set `SESSION_COOKIE_SECURE=true`. Production deployment also needs verified email/recovery, authentication abuse controls/rate limits, credential and secret management, TLS and a session persistence/scaling decision. These are not implemented in milestone 2. Login uses a generic invalid-credentials response; registration explicitly reports a duplicate email for this local demo.

## HTTP API

All paths below use `/api`. Mutation examples assume the CSRF token is in the header named by the `/auth/csrf` response. Login accepts `application/x-www-form-urlencoded`; registration and playlist payloads use JSON. Successful bodyless mutations return 204.

| Method | Path | Body / response |
| --- | --- | --- |
| GET | `/auth/csrf` | `{headerName, parameterName, token}`; public |
| POST | `/auth/register` | `{email, displayName, password}` → 201 `{id,email,displayName}` |
| POST | `/auth/login` | Form `email`, `password` → 204 and session cookie |
| GET | `/auth/me` | `{id,email,displayName}` or 401 |
| POST | `/auth/logout` | Invalidate current session → 204 |
| GET | `/library/favorites` | Ordered track DTO array |
| PUT / DELETE | `/library/favorites/{trackId}` | Add/remove favorite |
| GET | `/library/playlists` | Array of `{id,name,description,trackCount}` |
| POST | `/library/playlists` | `{name,description}` → 201 playlist detail |
| GET | `/library/playlists/{id}` | `{id,name,description,tracks}` |
| PUT | `/library/playlists/{id}` | `{name,description}` |
| DELETE | `/library/playlists/{id}` | Delete playlist and membership |
| PUT / DELETE | `/library/playlists/{id}/tracks/{trackId}` | Add/remove track |
| PUT | `/library/playlists/{id}/order` | `{trackIds:[…]}`; exact current membership |

## Frontend lifecycle

`AuthProvider` owns account state; `LibraryProvider` owns favorites for that account. The library subtree resets when the account changes so another user's data cannot remain displayed. `PlayerProvider` sits outside that reset boundary, preserving its audio element through login/logout and route changes. Page requests ignore results after unmount. Mutations show errors and retain the existing view until the server confirms success. Library pages include loading, empty and retry states.

The playlist picker uses a native modal dialog, with Escape/close controls and browser-managed focus trapping. Reordering uses labeled up/down buttons, including disabled first/last boundaries, so it is usable without drag-and-drop.
