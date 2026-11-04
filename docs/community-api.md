# Community API

The client uses focused reads; `GET /api/community` remains for compatibility.
All private reads validate the current Auth.js session and account revocation,
use `Cache-Control: no-store`, and expose a `Server-Timing: community` duration.

| Endpoint | Data / operation |
| --- | --- |
| `GET /api/community/conversations` | Friends, latest message preview, unread count, recent conversations first. No message history. |
| `GET /api/community/messages?peer=...` | Up to 50 messages and public peer details; requires an accepted friendship and no block in either direction. |
| `GET /api/community/messages?peer=...&cursor=...` | Older page using a `(createdAt, _id)` cursor, including messages with identical timestamps. |
| `POST /api/community/messages` | Existing validated `message` / `read` actions. Returns the persisted message on send. |
| `GET /api/community/contacts?tab=...` | `friends`, `requests`, `blocked`, `search&q=...`, or `relation&peer=...`. |
| `POST /api/community/contacts` | Request, accept, remove, block, unblock or report a player. |
| `GET /api/community/notifications` | Unread counts, incoming friend-request count, friend count and active room invitations. No message bodies. |
| `GET /api/community/search?q=...` | Public player discovery for guests, including Vietnamese accent-insensitive names. |

The shared in-memory client store is keyed by account and resource URL. It
coalesces in-flight requests, reuses recently loaded data, and clears previous
account data on logout/account changes. Chat contents are not stored in
localStorage. A late response cannot restore invalidated private data.

Party publishes signed, targeted change metadata (`kind`, `actor`, `peer`).
Message events refresh notifications, the conversation list and the affected
open thread. Read events refresh only counters/list previews. Friendship changes
invalidate contacts and clear the affected private thread before refetching.
No polling timer is used. Reconnect/focus/visibility recovery refreshes active
resources. Older Party versions without metadata fall back to broad invalidation
for compatibility. Deploy Party and frontend when releasing this change.

## Index migration and checks

`npm run community:indexes -- --test` targets the isolated review database;
`npm run community:indexes` targets the configured application database.
The migration adds indexes only and never drops indexes or edits user data.
It covers outgoing/incoming friendship lookups, reverse block lookup, message
ordering, unread counts and active room invitations. Re-running is safe.

Checks:

- `npm run typecheck`
- `npm run lint`
- `npm run test:community:cache`
- `npm run test:community`
- `npm run test:community:realtime` (review server on 3014 and Party on 1999)

Integration fixtures are isolated from real users. Local timings include test
DB network latency and do not establish production p95 latency. Inspect
`Server-Timing` in production separately from browser/network duration.
