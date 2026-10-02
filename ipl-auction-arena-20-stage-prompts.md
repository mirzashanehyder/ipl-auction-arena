# IPL Auction Arena — 20-Stage Build Prompts

Use these with your AI coding tool (Antigravity or similar). Paste the
Kickoff prompt first, then one stage prompt at a time — do not paste
multiple stages in one message. Each stage prompt already tells the
tool to implement only that stage, test it, explain what it built, and
stop for your confirmation, so you don't need to retype that rule.

**Stack (repeat if your tool loses project context):**
Frontend: React + Vite + React Router + Tailwind CSS + Socket.IO client + Axios
Backend: Node.js + Express + Socket.IO
Database: PostgreSQL + Prisma ORM
Deploy: Vercel (frontend) / Render (backend) / Neon (DB)

---

## Kickoff Prompt — Roadmap only, no code

```
I'm building "IPL Auction Arena," a real-time multiplayer IPL-style
cricket auction web app. [Paste your full 26-section spec here, or
summarize: private auction sessions with shareable room codes, team
selection with fixed virtual purse, live server-authoritative bidding
with a synchronized timer, permanent player database separate from
per-auction player pools, host controls, reconnection handling,
results dashboard, deployment on Vercel/Render/Neon.]

Do NOT write any code yet. First produce a detailed implementation
roadmap covering Stage 1 through Stage 20 (I'll give you the stage
list). For each stage, state: the goal, features included, backend
work, frontend work, database work, Socket.IO work, how I'll manually
test it, and what it depends on from earlier stages.

Then STOP and wait for me to say "START STAGE 1."
```

---

## Stage 1 — Project Setup

```
STAGE 1 ONLY. Set up a monorepo: /client (React + Vite + React Router
+ Tailwind CSS + Socket.IO client + Axios) and /server (Node.js +
Express + Socket.IO + Prisma). Add a health-check route, a root
package.json to run both concurrently in dev, .env.example for both
packages, and a README with setup steps. No game logic yet.

When done: list every file created, explain how to run the dev
servers, tell me how to verify the client can reach the server's
health check, flag anything unfinished, then STOP and wait for me to
say "START STAGE 2."
```

---

## Stage 2 — Prisma + PostgreSQL Database

```
STAGE 2 ONLY. Design schema.prisma for these models and their
relations: User/Participant, AuctionSession, Team, Player,
AuctionPlayer (junction between AuctionSession and Player), Bid,
Squad/PlayerPurchase.

Key rules to encode:
- Player is permanent, reusable across auction sessions — never
  mutated by auction results.
- AuctionPlayer links an AuctionSession to a Player with its own
  status (AVAILABLE, CURRENT, SOLD, UNSOLD), soldToTeamId, soldPrice —
  this is where per-auction outcomes live, not on Player itself.
- Team has id, name, shortName, logoUrl, and the session records each
  team's starting/remaining purse per AuctionSession (a team's purse
  is per-session, not a fixed property of Team).
- AuctionSession has status LOBBY/LIVE/PAUSED/COMPLETED, room code
  (unique), host reference, configurable starting purse and minimum
  bid increment.
- Set cascade rules so deleting an AuctionSession never deletes
  permanent Player or Team data.
- Add indexes on AuctionSession.roomCode and AuctionPlayer.sessionId.

Generate and run the initial migration.

When done: show the schema, explain each relation choice, confirm the
migration ran cleanly, then STOP and wait for "START STAGE 3."
```

---

## Stage 3 — Player Dataset + Seed System

```
STAGE 3 ONLY. Create /server/data/players.json with a demo dataset of
~40 IPL-style players — id, name, role (BATSMAN/BOWLER/ALL_ROUNDER/
WICKET_KEEPER), country, basePrice, category (e.g. Marquee/Capped/
Uncapped), battingStyle, bowlingStyle, isActive. Also seed a fixed set
of 10 IPL franchise Teams with name, shortName, logoUrl placeholder.

Write a Prisma seed script (npm run seed) that reads players.json,
inserts players and teams into PostgreSQL, skips duplicates, and is
safe to re-run in development. Do NOT hardcode this data into any
React component — it must only live in the database via the seed.

When done: confirm the seed ran, show a sample of inserted rows, then
STOP and wait for "START STAGE 4."
```

---

## Stage 4 — Create Auction Session

```
STAGE 4 ONLY. Implement POST /sessions: host provides a name, starting
purse (configurable, default e.g. ₹120 Cr), minimum bid increment
(configurable), and which player pool to use. Server creates an
AuctionSession with a unique human-readable room code (e.g.
IPL-X7K92P), creates the host as the first Participant, and returns
the room code plus a shareable invite URL.

Frontend: a "Create Auction" page (host name, starting purse, bid
increment, player pool selection) that on success shows the room code
big and bold, a "copy invite link" button, and a share button.

No sockets yet — plain REST. When done: list files, explain how to
test creating a session via the UI, then STOP and wait for "START
STAGE 5."
```

---

## Stage 5 — Join Auction via Room Code/Link

```
STAGE 5 ONLY. Implement GET /sessions/:code (session details +
current participants) and POST /sessions/:code/join (participant
provides display name only, no team yet — team selection is Stage 7).
Reject joining if session status is not LOBBY.

Frontend: a join page reachable either by the invite link or by
entering a room code manually on the home page, asking only for a
display name, then landing in a waiting-room view showing the room
code and a list of who's joined so far (no live updates yet — that's
Stage 6).

When done: explain how to test with two separate browser profiles,
then STOP and wait for "START STAGE 6."
```

---

## Stage 6 — Multiplayer Lobby + Socket.IO Rooms

```
STAGE 6 ONLY. Wire Socket.IO on top of the existing join flow, without
changing the REST endpoints. On connection, client emits a handshake
with {sessionCode, participantId}; server joins that socket to a
Socket.IO room keyed by the session code and marks the participant
connected in the DB. Broadcast participantJoined / participantLeft to
everyone in that room whenever someone joins/disconnects. On
disconnect, mark disconnected but do not remove the participant
(reconnection is handled fully in Stage 15, but lay the groundwork:
store participantId + sessionCode in client localStorage now so
refreshes can re-identify the same participant).

Frontend: the waiting-room participant list updates live via sockets
instead of a one-time fetch; show a connected/disconnected dot per
participant.

When done: explain how to test with 3 browser sessions joining/
leaving, then STOP and wait for "START STAGE 7."
```

---

## Stage 7 — Team Selection

```
STAGE 7 ONLY. Implement teamSelected / teamReleased: participant picks
one of the 10 seeded Teams for this session. Server must enforce, in a
DB transaction (not check-then-write), that a team can belong to only
one Participant per AuctionSession — reject with a clear error on
race conditions. Broadcast the updated team-availability map to
everyone in the session immediately on any selection.

Frontend: team selection grid on the lobby screen — team logo, name,
visually disabled/grayed if already taken, with the taker's name shown
on hover. Each participant starts with the session's configured
starting purse the moment they claim a team.

When done: explain how to test two people racing to claim the same
team from two browsers simultaneously, then STOP and wait for "START
STAGE 8."
```

---

## Stage 8 — Auction Player Pool

```
STAGE 8 ONLY. On auction creation (or as a host action before start),
populate AuctionPlayer rows linking the chosen player pool's Players
to this AuctionSession, each starting as AVAILABLE with an
auctionOrder (random shuffle or fixed order — host's choice at
creation). Add a host-only GET endpoint to preview the full queue
before starting.

When done: explain how to verify the queue was created correctly and
in the right order, then STOP and wait for "START STAGE 9."
```

---

## Stage 9 — Server-Authoritative Auction Engine (core state)

```
STAGE 9 ONLY. Implement auctionStarted and currentPlayer: host-only
action that sets AuctionSession status to LIVE, pulls the first
AVAILABLE AuctionPlayer by order, sets it CURRENT, and broadcasts the
full current-player payload (player details, base price, current bid
= base price, highest bidder = none) to everyone in the session. Do
NOT implement bidding or the timer yet — just the state transition and
broadcast, so we can verify everyone sees the exact same player at the
exact same moment before adding bid complexity.

When done: explain how to verify with 3 browsers that all see
identical currentPlayer data, then STOP and wait for "START STAGE 10."
```

---

## Stage 10 — Real-Time Bidding + Validation

```
STAGE 10 ONLY. Implement bidPlaced → server validates, in this exact
order, and responds with bidAccepted or bidRejected (with a specific
reason string, never silent failure):
1. AuctionSession status is LIVE and this AuctionPlayer is CURRENT
2. participant is connected and has claimed a team in this session
3. bid amount is strictly greater than current bid AND is a valid
   multiple of the session's configured minimum increment above the
   current bid (e.g. current ₹5 Cr, increment ₹0.2 Cr → ₹5.2 Cr valid,
   ₹5.1 Cr rejected)
4. participant's team purse remaining covers the bid
5. auction timer has not expired (timer itself lands in Stage 11 — for
   now, gate on AuctionPlayer still being CURRENT)

On bidAccepted: update AuctionPlayer's current bid/bidder, broadcast
bidAccepted with the new state to the whole session. Ensure bids for
the same session are processed one at a time (no double-accept from
near-simultaneous bids).

Frontend: bid buttons showing the next valid increment(s), disabled if
purse can't cover it, optimistic UI (show the bid as pending
instantly, reconcile on bidAccepted/bidRejected).

When done: explain how to test two people bidding within the same
second from two browsers, then STOP and wait for "START STAGE 11."
```

---

## Stage 11 — Timer Synchronization

```
STAGE 11 ONLY. Add server-owned timing to the auction engine. On
currentPlayer and on every bidAccepted, server sets/resets an
absolute endsAt timestamp (e.g. now + 15s on a fresh bid, capped so a
single player's total auction time can't exceed a hard ceiling like 2
minutes) and broadcasts timerUpdated with that endsAt. The client NEVER
owns the authoritative countdown — it only computes endsAt - Date.now()
locally to render. Reject any bid where the server's own clock shows
endsAt has already passed, even if the client sent it in time (network
lag).

Frontend: countdown numeric readout (not just a color bar) driven by
the server's endsAt.

When done: explain how to test that a bid sent right as the timer
hits zero is correctly rejected, then STOP and wait for "START STAGE
12."
```

---

## Stage 12 — Sold / Unsold Player Logic

```
STAGE 12 ONLY. Server-side, when endsAt passes with no further valid
bid: if there's a highest bidder, mark AuctionPlayer SOLD, create a
Squad/PlayerPurchase record, deduct the sold price from that team's
session purse, broadcast playerSold with full details. If no bids were
ever placed, mark UNSOLD and broadcast playerUnsold. Either way,
automatically advance via nextPlayer to the next AVAILABLE
AuctionPlayer after a short pause, or broadcast auctionEnded if the
queue is exhausted.

When done: explain how to test a full sold cycle and a full unsold
cycle end-to-end, then STOP and wait for "START STAGE 13."
```

---

## Stage 13 — Squad + Purse Management

```
STAGE 13 ONLY. Add GET /sessions/:code/squads returning every
participant's team, purse remaining, squad size, and full player list
with prices. Broadcast an updated squads snapshot alongside every
playerSold so clients refresh without polling.

Frontend: a live sidebar/panel (collapsible on mobile) showing every
team as a compact card — purse remaining as number + progress bar,
squad count, expandable full player list — with the current user's own
team visually distinct from the rest.

When done: explain how to verify purse math stays correct across
several sales, then STOP and wait for "START STAGE 14."
```

---

## Stage 14 — Host Controls

```
STAGE 14 ONLY. Implement auctionPaused, auctionResumed, and host-only
skip-current-player (force UNSOLD), force-sell (host manually assigns
current player to a chosen participant at a chosen price, still
purse/validity-checked server-side), and auctionEnded (host ends early
regardless of remaining queue). Every host action must verify
server-side that the requesting participant is this session's host —
reject forged host actions from anyone else with a clear error, don't
just hide the button client-side.

Frontend: a host-only control bar, visually distinct (e.g. a recessed
admin strip), rendered only for the host.

When done: explain how to verify a non-host cannot trigger host
actions even via a raw socket emit, then STOP and wait for "START
STAGE 15."
```

---

## Stage 15 — Reconnection / State Synchronization

```
STAGE 15 ONLY. Implement participantReconnected and auctionState: on
socket connect, if the client has a stored participantId + sessionCode
in localStorage, the server re-associates the socket with that
existing Participant (marks connected again, does NOT create a new
participant or free their team) and immediately sends back a full
auctionState snapshot (current player, current bid, highest bidder,
remaining time, session status, all team purses, all squads) so the
client can fully rehydrate instead of starting blank. Handle duplicate
socket connections from the same participant (e.g. two tabs) by
keeping the latest connection authoritative.

When done: explain how to test refreshing mid-auction and confirm you
land back in the exact live state, then STOP and wait for "START
STAGE 16."
```

---

## Stage 16 — Live Auction UI (make this genuinely attractive, not just functional)

```
STAGE 16 ONLY. This stage is a dedicated visual design pass on the
live auction screen and lobby — treat it as a design task, not just
"wire up the existing data." Do NOT use default Tailwind grays/blues
or generic card-with-shadow components. I want this to feel like a
televised cricket auction broadcast, not an admin form.

Design direction:
- Theme: deep navy/charcoal background with a warm gold/amber accent
  for money figures, bids, and the "live" state — this pairing reads
  as "premium auction," not "SaaS dashboard." Pick one distinctive
  display font for numbers/prices (bids should feel like a scoreboard)
  and a clean sans for body text — not the Tailwind default stack.
- Player card: large, center-stage, with a subtle glow/border
  treatment when a player is LIVE, a role badge (batter/bowler/
  all-rounder/keeper) as a small colored tag, and the current bid
  rendered LARGE — this number is the emotional center of the screen.
- Timer: a circular or radial countdown (not a plain text number or a
  flat progress bar) that visibly tightens/changes color as it nears
  zero, plus a numeric readout for accessibility — this is the single
  highest-tension element on screen and should look like it.
- Bid buttons: tactile — visible press/hover states, maybe a subtle
  scale animation on click — these get clicked under time pressure and
  should feel responsive, not like a static form button.
- "SOLD" moment: a brief full-card animation/flash (color shift +
  scale pulse) plus an auction-hammer sound cue (muted by default,
  toggle to enable) before transitioning to the next player — this
  single moment is what will make the app feel alive to your friends.
- Squad sidebar: team logo, purse as both number and a shrinking
  progress bar (visually shows scarcity), collapsible drawer on mobile
  so the player card stays primary on small screens.
- Layout: everything critical (player card, bid controls, timer,
  squad panel) visible without scrolling at 1366x768; responsive, not
  just shrunk, at 375px width.
- Empty/loading/error states for every screen (session not found,
  socket disconnected mid-auction, host left) — don't skip these.

Go screen by screen (lobby, live auction, squad panel) and describe
the specific visual treatment before implementing it, so I can approve
the direction before you build it.

When done: explain what was built and how to review it in-browser,
then STOP and wait for "START STAGE 17."
```

---

## Stage 17 — Results Dashboard

```
STAGE 17 ONLY. Add GET /sessions/:code/results: final squads per team
with total spend, unsold players list, and a "Most Expensive Buy"
highlight stat. Frontend results page: clean grid per team, a
highlighted banner for the top sale, unsold list, and a "copy summary
to clipboard" share action. Visually consistent with the Stage 16
theme, not a plain table.

When done: explain how to verify results match the actual sale
history, then STOP and wait for "START STAGE 18."
```

---

## Stage 18 — Error Handling + Security

```
STAGE 18 ONLY. Audit and harden: session existence checks on every
endpoint/socket handler, participant existence checks, team-ownership
checks, host-permission checks on every host action, bid amount and
purse re-validation server-side (never trust any client-sent computed
value), player/session status checks, duplicate-request protection
(e.g. double-submitted bid from a double-click). Confirm no database
credentials or secrets are exposed client-side; confirm .env.example
is accurate and complete for both packages.

When done: list every hardening change made and why, then STOP and
wait for "START STAGE 19."
```

---

## Stage 19 — Multi-Browser Testing

```
STAGE 19 ONLY. Do not write new features. Walk through a full auction
end-to-end using at least 3 separate real browser sessions (not tabs
— use separate browser profiles or incognito windows so sockets are
fully isolated): create session, join, claim teams, run a full auction
with concurrent bids from multiple participants, force a reconnection
mid-auction, test host controls, reach results. Log any bug found with
exact repro steps, then fix only what's broken — smallest safe change,
no rewrites of working code.

When done: report what was tested, what broke, what was fixed, then
STOP and wait for "START STAGE 20."
```

---

## Stage 20 — Production Deployment

```
STAGE 20 ONLY. Prepare for deployment: frontend on Vercel, backend on
Render, database on Neon. Add VITE_API_URL / VITE_SOCKET_URL env vars
on the client pointing at the deployed backend. Configure CORS (both
Express and Socket.IO) to allow only the deployed Vercel origin. Set
up Prisma's DATABASE_URL for Neon's pooled connection mode
(pgbouncer), documenting both pooled and direct connection strings if
migrations need the direct one. Add a production start script. Write
DEPLOYMENT.md with exact steps and required env vars per service.

When done: confirm the deployed app works end-to-end with 2 real
separate devices/networks (not just two browsers on your own wifi, to
catch any WebSocket/CORS issue that only shows up cross-network), then
report done.
```

---

## Notes

- This mirrors your spec's data model (permanent `players` vs.
  session-scoped `auction_players`), your named socket events, your
  configurable purse/increment, and your stage-by-stage stop-and-wait
  methodology throughout.
- Review Stage 10 and Stage 11's generated code by hand — bid
  validation order and timer authority are where AI tools most often
  introduce a subtle bug (e.g. trusting a client timestamp, an
  off-by-one on the increment check).
- Stage 16 is deliberately written to force a design conversation
  before code — if you skip reviewing its output before approving,
  you'll likely get a generic dashboard look back.
