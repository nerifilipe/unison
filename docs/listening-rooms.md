# Listening rooms

Rooms are unlisted sessions for signed-in listeners. One host controls a common playback timeline; everyone can add catalog tracks and vote on the queue. Audio streams directly from S3 through the existing media gateway. The WebSocket transports state, not audio.

## Try locally

1. Sign in, open **Listening rooms**, enter a name and select **Create room**.
2. Use **Queue** to add tracks. Copy the invitation link.
3. Open a private/incognito window on the same computer, sign in with a different account, open the invitation and select **Join room**. The accounts are isolated browser sessions.
4. The host selects **Play room**. Each listener selects **Enable room audio** once when prompted by their browser.
5. Vote to move a track up the queue. The host can pause, seek or skip; an ended track advances automatically. Ties follow insertion order.
6. Navigate to another page: the same player remains synchronized. Its room link returns to the room. Leave the room before playing independently.

The Compose app binds to loopback. A `localhost` invitation works on the same computer; it is not a public or LAN deployment. Public hosting/TLS is a later milestone.

## State and concurrency

`dev.unison.rooms` is an ephemeral, single-instance module. Room state contains a random UUID, name, host UUID, members, queue entries/vote sets, revision, track, play/pause state, and a position/time anchor. It reads metadata through `CatalogReader`; catalog entities remain private. No email addresses or account credentials appear in room snapshots.

All operations for a room run under its monitor. Every effective mutation increments a revision. Host commands carry the last observed revision; a stale command returns 409 instead of overwriting intervening changes. The UI displays that conflict so the host can try again on the latest state. Queue additions are unique by track within the queue (409 on duplicates), votes are idempotent sets per member/entry, and ties use an increasing insertion sequence. Queued tracks can be re-added after they start playing. Leaving removes a member's votes. Only the host can remove queue entries or change playback. The server discards removed catalog tracks on reconciliation.

Rooms end when their host explicitly leaves, after 30 minutes without activity, or when the backend restarts. Host loss of contact pauses playback after 30 seconds without a client ping; reconnect restores membership but does not automatically resume a room already paused by that timeout. The host can press Play again. No automatic host transfer is implemented. Limits: 100 rooms per backend, 3 owned rooms per account, 50 members and 100 queued tracks per room, 300 sockets overall and 5 sockets per account.

An independent server tick advances playback at the current track duration and prunes unavailable tracks. A four-thread scheduled pool prevents FFmpeg's synchronous processing job from occupying the only scheduling thread. Room monitors serialize competing HTTP, broadcast and timer operations. This is suitable for a small local demo; multi-instance coordination, durable rooms and high-fanout distribution are follow-ups.

## HTTP commands

All routes require authentication. All mutations require the existing CSRF header/token. An invitation is not a replacement for authentication; possession of its UUID allows a signed-in user to join. Nonmembers cannot read or mutate room state (404).

| Method/path | Body | Result |
| --- | --- | --- |
| `POST /api/rooms` | `{ "name": "After hours" }` | 201 snapshot; caller is host |
| `POST /api/rooms/{id}/join` | None | 200 snapshot; idempotent membership |
| `GET /api/rooms/{id}` | None | 200 member snapshot |
| `DELETE /api/rooms/{id}/membership` | None | 204; host leave ends the room |
| `POST /api/rooms/{id}/queue` | `{ "trackId": "first-light" }` | 200 snapshot |
| `PUT /api/rooms/{id}/queue/{entry}/vote` | `{ "enabled": true }` | 200 snapshot; one vote per account |
| `DELETE /api/rooms/{id}/queue/{entry}` | None | 200 snapshot; host only |
| `POST /api/rooms/{id}/control` | `{ "action": "seek", "position": 25, "revision": 8 }` | 200 snapshot; host only |

Actions: `play`, `pause`, `seek`, `next`. Include `position` (0 when unused) and `revision`. Seeking must remain within the current track. Empty Play does nothing; Next consumes the highest-ranked queue entry and starts it, or clears playback when the queue is empty.

## WebSocket protocol and security

Connect to `/ws/rooms/{id}` after joining. Spring authenticates the HTTP upgrade via the session cookie; the handshake verifies membership. Allowed browser origins are explicitly configured through `ROOM_ALLOWED_ORIGINS`, with local app/Vite origins as defaults. There is no wildcard. Nginx and Vite proxy WebSocket upgrades.

The server sends JSON `{ "state": snapshot, "echo": null }` every second. A client sends its current millisecond timestamp as a text message every five seconds; the reply echoes it along with a fresh snapshot. Client pings update presence; outgoing broadcasts alone do not. Incoming text is limited to 64 bytes and rapid pings are ignored. There are no WebSocket write commands: mutations remain CSRF-protected HTTP requests. Concurrent socket sends use Spring's session decorator with bounded send time/buffering.

Snapshots contain `id`, `name`, `hostId`, `revision`, `serverTime`, `track`, `playing`, `position`, `members` and `queue`. Member names/online flags and per-viewer `voted` flags are supplied; queue entries include ID, track and vote count. Full snapshots make reconnect independent of missed incremental events.

Session validity and membership are checked before every send. Logout invalidates existing connections: the application uses close code 4001, while the servlet container can close first with policy code 1008. The client rechecks authentication on policy closure. Room end/member removal uses 4004. Passive WebSocket listening does not renew the HTTP session; the existing 30-minute HTTP inactivity timeout still applies.

## Clock and player behavior

For timestamp exchange `sent` → server snapshot → `received`, the client estimates clock offset as `serverTime - (sent + received)/2`. It computes the target playback position from the snapshot position plus elapsed server time while playing. Lower revisions/older snapshots are ignored.

`PlayerProvider` still owns exactly one audio element. Room state changes set its source and transport; a 400 ms reconciliation checks drift and seeks when the discrepancy exceeds 600 ms. Local volume stays independent. Host controls live in the room UI; the footer's independent play/seek controls are disabled in room mode. Browser autoplay restrictions expose an explicit Enable room audio button. Reload requires enabling audio again.

Connection loss pauses the local audio. A six-second message watchdog detects silent connections; reconnection backs off from one to ten seconds, revalidates membership and restores a complete snapshot. The active room ID is saved per account in sessionStorage to restore the room after a page reload. No account token is stored there. Synchronization is best effort, not sample-accurate: buffering, network latency, background-tab throttling and device output latency can cause audible differences.

## Verification

Backend tests exercise concurrent revision conflicts, vote idempotency/order, host authority, automatic advancement, host-away pause, inactivity expiry, member leave, deleted tracks and room end. Browser tests use two independent accounts and real WebSockets/audio; the guest clock is deliberately offset by two minutes. They check drift, pause/seek, queue advancement, navigation, reconnect, CSRF, ownership, hostile origins and logout invalidation. See [verification](verification.md) for results and current browser coverage.

Implementation reference: [Spring WebSocket server API](https://docs.spring.io/spring-framework/reference/web/websocket/server.html).
