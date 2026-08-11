# Orion Connect v3 Low-Latency Implementation Plan

## Purpose

This plan is designed for **Antigravity using Gemini 3.6 Flash**.

Because a Flash model may over-refactor, skip edge cases, or make assumptions, this plan is intentionally:

- Narrow
- Sequential
- Defensive
- Explicit about what must **not** be changed
- Structured so each phase can be implemented and tested independently

---

# Primary Objective

Eliminate:

- Laser cursor trailing behind finger movement
- Cursor backlog / catch-up behavior
- Lag caused by high-frequency pointer traffic
- Reliable controls becoming stuck in loading states after continuous usage

While preserving the current **Smart Connect v3 security architecture**.

---

# Critical Rules for Antigravity

Do **not**:

- Rewrite Smart Connect
- Replace WSS
- Remove TLS
- Remove certificate/fingerprint pinning
- Alter pairing/authentication
- Change device-bound trust
- Change port 8924
- Change protocol version from v3
- Refactor unrelated Orion code
- Rename unrelated files/functions
- Convert unrelated JS files to TypeScript
- Add large dependencies
- Add cursor smoothing before actual latency is fixed

The purpose is to improve **traffic scheduling and realtime input handling**, not redesign Orion Connect.

---

# Current Smart Connect v3 Path

```text
Mobile Finger / PanResponder
        ↓
useRemotePointer.ts
        ↓
useConnectController.ts
        ↓
secureConnectClient.ts
        ↓
nativeSecureConnect.ts
        ↓
React Native Native Bridge
        ↓
OrionSecureConnectModule.kt
        ↓
OkHttp WebSocket.send()
        ↓
TLS / WSS
        ↓
Desktop smartConnectIpc.js
        ↓
Rate Limiter
        ↓
Electron Main
        ↓
webContents.send()
        ↓
Preload Bridge
        ↓
Desktop Renderer
        ↓
useSmartConnectRemoteCommands.js
        ↓
Laser DOM Node
```

---

# Core Architectural Rule

Smart Connect must treat commands as **two different traffic classes**.

## 1. Reliable Commands

Examples:

- `toggle_play`
- `play_pause`
- `cursor_click`
- `seek_to`
- `seek_-10`
- `seek_+10`
- `next`
- `previous`
- `toggle_mute`
- `volume_up`
- `volume_down`
- `toggle_subtitles`
- `toggle_fullscreen`

Reliable command rule:

```text
Every accepted command must terminate in:

ACK success
OR
explicit error
OR
socket failure
OR
timeout
```

Reliable commands must **never** be silently sacrificed because cursor traffic is busy.

---

## 2. Realtime State

Primary example:

- `cursor_move`

Potential realtime traffic:

- pointer telemetry
- scroll telemetry, but handle carefully because scroll is delta-based

Realtime rule:

> **Newest state wins. Old state is disposable.**

Example:

```text
Finger generates:

A → B → C → D → E → F → G
```

Wrong:

```text
A → B → C → D → E → F → G
                    ↓
                  queue
                    ↓
            desktop catches up later
```

Correct:

```text
A
B replaces A
C replaces B
D replaces C
E replaces D
F replaces E
G replaces F

Transport becomes available:

send G
```

Never process historical cursor movement simply because it arrived.

---

# Phase 0: Baseline and Safety Checkpoint

## Files to inspect first

### Mobile

- `useRemotePointer.ts`
- `useConnectController.ts`
- `secureConnectClient.ts`
- `nativeSecureConnect.ts`
- `OrionSecureConnectModule.kt`

### Desktop

- `smartConnectIpc.js`
- `secureTrust.js`
- `useSmartConnectRemoteCommands.js`
- `global.css`

## Instructions

Before making any code changes:

1. Identify the exact cursor sender.
2. Identify the secure envelope sender.
3. Identify the native Android socket sender.
4. Identify the desktop command rate limiter.
5. Identify the Electron IPC cursor path.
6. Identify the renderer cursor update function.
7. Identify the cursor cleanup/hide timer.
8. Record a short baseline description.

Do **not** modify code during this phase.

## Done When

Antigravity can explain the exact current path:

```text
Finger → Mobile JS → Native bridge → OkHttp → WSS →
Desktop server → Electron IPC → Renderer → Laser DOM
```

without changing anything.

---

# Phase 1: Explicitly Separate Traffic Classes

Do not change protocol v3.

Define two internal categories:

## Realtime

```text
cursor_move
```

Potentially:

```text
scroll
```

But do not aggressively coalesce scroll initially because scroll represents **delta**, not an absolute position.

## Reliable

Everything else that represents an action.

Examples:

```text
cursor_click
toggle_play
seek_to
next
previous
mute
volume
fullscreen
```

## Important

Do not rename existing actions.

Do not create protocol v4.

Extend the existing `FIRE_AND_FORGET_ACTIONS` design rather than replacing the command system.

## Done When

Realtime and reliable commands have explicit internal handling paths while still using Smart Connect v3.

---

# Phase 2: Mobile Latest-Position Coalescing

## Target File

`useConnectController.ts`

## Problem

Currently pointer movement can repeatedly call the transport every ~16 ms.

Even though it is fire-and-forget, that does **not** mean old unsent coordinates disappear.

## Required Change

Introduce something conceptually like:

```ts
latestCursorPayloadRef
cursorSendScheduledRef
```

When:

```text
A
B
C
D
```

arrive quickly:

```text
pending = A
pending = B
pending = C
pending = D
```

Only the newest unsent pointer state should survive.

Do not use:

```ts
[]
```

as a cursor queue.

Do not retain every historical coordinate.

## Keep Current Sampling Initially

Keep approximately:

```text
16 ms / ~60 Hz
```

Do **not** reduce to 30 Hz as a shortcut.

## Do Not Add

- LERP
- springs
- CSS smoothing
- artificial delay

## Done When

Mobile can never build an unbounded queue of `cursor_move` states.

---

# Phase 3: Dedicated Native Realtime Send Path

## Target Files

- `OrionSecureConnectModule.kt`
- `nativeSecureConnect.ts`
- `secureConnectClient.ts`
- `useConnectController.ts`

## Existing Behavior

Normal native sending uses:

```kotlin
@ReactMethod
fun sendSocket(payload: String, promise: Promise) {
    promise.resolve(socket?.send(payload) == true)
}
```

This means each pointer packet crosses a Promise-based bridge.

## Required Change

Keep the existing `sendSocket()` for normal/reliable traffic.

Add a separate method such as:

```kotlin
sendRealtimeSocket(...)
```

Purpose:

- Use the already-open authenticated OkHttp WebSocket
- Send realtime telemetry directly
- No ACK tracking
- No retry queue
- No extra application-level backlog
- Minimal bridge overhead

Expose through:

```text
nativeSecureConnect.ts
secureConnectClient.ts
```

Then route `cursor_move` through the realtime method.

## Security Must Stay Unchanged

Do not modify:

- `openSocket()`
- fingerprint validation
- TLS
- WSS
- authentication ticket
- device ID validation
- Android KeyStore
- session identity

## Done When

`cursor_move` has a minimal native send path while reliable controls continue using the normal sender.

---

# Phase 4: Native WebSocket Backpressure Protection

This phase is useful but should not block the core fix.

## Objective

Prevent temporary Wi-Fi or thread stalls from turning into seconds of stale cursor movement.

## Required Behavior

If OkHttp exposes a valid outbound queue metric:

- inspect it
- apply a conservative threshold for realtime traffic only

When realtime outbound data is already backed up:

```text
Do not keep adding old cursor positions.
```

Instead:

```text
drop superseded cursor state
keep latest state
```

## Critical Rule

Never disconnect merely because cursor telemetry becomes temporarily congested.

Never drop reliable commands because of cursor backpressure.

## Important for Gemini

If the installed OkHttp version does **not** expose the needed queue API:

> Do not invent an API.

Fall back to JS-side latest-state coalescing.

## Done When

Network stalls cannot create a long historical cursor trail.

---

# Phase 5: Split Desktop Rate Limiting

## Target Files

- `smartConnectIpc.js`
- possibly `secureTrust.js`

## Existing Problem

The server currently has one shared command counter:

```text
commandRatePerSecond = 120
```

Pointer traffic and reliable buttons can consume the same rate budget.

## Required Change

Create separate logical limits.

Conceptually:

```text
Realtime Rate Bucket
Reliable Rate Bucket
```

### Realtime Bucket

Used for:

```text
cursor_move
possibly scroll
```

Realtime events may be intentionally dropped.

### Reliable Bucket

Used for:

```text
cursor_click
toggle_play
seek
next
previous
volume
mute
fullscreen
etc.
```

Reliable actions must have protected capacity.

## Do Not

Simply change:

```text
120 → 5000
```

That hides the architectural issue and weakens abuse protection.

## Important

`cursor_click` is a reliable action.

It must not be treated like disposable pointer movement.

## Done When

Continuous laser movement cannot consume the rate budget required by Play/Pause/Seek/Click.

---

# Phase 6: Coalesce Cursor Before Electron IPC

## Target File

`smartConnectIpc.js`

## Existing Problem

Every accepted cursor packet can immediately cause:

```js
notifyDesktopRenderer("orion:remote-command", command)
```

If renderer IPC falls behind, historical pointer events may queue.

## Required Change

Maintain:

```js
latestCursorCommand
```

Every new cursor packet replaces the previous pending cursor command.

Add a lightweight scheduled flush.

Target:

```text
maximum ~60 cursor IPC sends/sec
```

Each flush sends only the newest available cursor state.

Example:

```text
Incoming:
A B C D E F

Pending:
A
B replaces A
C replaces B
D replaces C
E replaces D
F replaces E

IPC flush:
F
```

## Scroll

Do not blindly coalesce scroll like cursor position.

Scroll is delta-based.

Keep scroll separate until explicitly redesigned.

## Reliable Commands

Continue through:

```text
dispatchCommand()
ACK
```

without being affected by pointer coalescing.

## Done When

100 incoming pointer packets cannot become 100 stale IPC events after renderer stalls.

---

# Phase 7: Renderer Latest-State + requestAnimationFrame

## Target File

`useSmartConnectRemoteCommands.js`

## Required Design

Incoming cursor command:

```text
update latestPointer
```

Do not immediately apply every network packet to the DOM.

Use one renderer loop:

```js
requestAnimationFrame(...)
```

The RAF loop should:

1. Read latest pointer state.
2. If pointer changed:
   - calculate screen coordinates
   - apply one `translate3d()`
3. Request next frame.

## Critical Rules

- Only one RAF loop.
- Do not create one RAF per pointer packet.
- Do not use React state for every pointer frame.
- Continue using direct DOM transform.
- Latest pointer state must overwrite older pending state.

## Why

Network event frequency and monitor refresh frequency should be independent.

The screen should render the newest known state on each frame.

## Done When

Desktop rendering follows latest state rather than packet history.

---

# Phase 8: Fix Laser Hide / Unhide Lifecycle

## Target File

`useSmartConnectRemoteCommands.js`

Possibly:

`global.css`

## Existing Problem

Current behavior:

- pointer moves
- clear old timeout
- create another 4-second timeout
- repeat around 60 times/sec
- cursor eventually gets removed from DOM
- next movement recreates the DOM node

## Required Change

Do not remove the cursor DOM node during normal inactivity.

Create it once.

Keep it mounted.

Use:

```text
opacity
visibility
```

to hide/show it.

Track:

```js
lastCursorActivityAt
```

On every pointer update:

```js
lastCursorActivityAt = performance.now()
```

Do not create/reset a 4-second timeout on every frame.

The RAF loop or a low-frequency inactivity check should decide:

```text
now - lastCursorActivityAt >= 4000
```

Then hide the cursor.

On new input:

```text
show cursor immediately
```

On Smart Connect disconnect:

```text
hide immediately
```

## CSS

Do not add a transform transition.

A small opacity transition is acceptable.

Do not animate cursor position using CSS transition.

## Done When

Continuous cursor movement causes:

```text
0 repeated DOM creation/removal
0 high-frequency timeout churn
```

---

# Phase 9: Do Not Add Smoothing Yet

This phase is deliberately delayed.

First verify:

```text
Finger movement → laser follows almost immediately
```

If cursor becomes responsive but appears slightly stepped on:

- 120 Hz
- 144 Hz
- higher refresh displays

then optional smoothing may be tested.

## If Added Later

Use only tiny adaptive interpolation.

Requirements:

- target position remains authoritative
- cursor catches up immediately on large distance changes
- never create visible trailing
- never use a slow spring
- never use CSS `transition: transform`

## Important

Do not turn:

```text
laggy cursor
```

into:

```text
smoothly animated laggy cursor
```

Actual transport latency must be fixed first.

---

# Phase 10: Protect Reliable Command Loading State

## Target Area

`sendRemoteCommand()` and ACK lifecycle.

## Required Rule

Every reliable command must end with exactly one result:

```text
ACK success
explicit server error
socket failure
timeout
```

Never leave the UI waiting indefinitely.

## Required Testing

While continuously moving the laser:

- press Play/Pause repeatedly
- seek
- mute
- volume
- fullscreen
- next / previous
- cursor click

Pointer activity must not prevent ACK completion.

## Important

Do not ACK `cursor_move`.

Keep ACKs for reliable commands.

## Done When

Moving the laser continuously cannot strand buttons in a loading state.

---

# Phase 11: Add Development Diagnostics

Do not log every cursor packet.

Per-packet logging can itself create lag.

Instead add aggregated development-only counters.

Suggested counters:

```text
cursorGenerated
cursorSent
cursorCoalesced
cursorReceivedDesktop
cursorForwardedIPC
cursorRendered
realtimeRateDrops
reliableRateDrops
```

If OkHttp supports it:

```text
webSocketQueueBytes
```

## Logging Frequency

Aggregate every few seconds in development mode only.

Example:

```text
Cursor Stats
generated: 1200
sent: 720
coalesced: 480
receivedDesktop: 718
ipcForwarded: 700
rendered: 698
realtimeDrops: 2
reliableDrops: 0
```

Coalescing is expected.

Reliable drops should ideally remain:

```text
0
```

## Done When

Intentional coalescing can be distinguished from accidental packet loss.

---

# Phase 12: Regression Testing

Test each scenario separately.

## Laser

- slow movement
- fast movement
- rapid circles
- zig-zag movement
- sudden direction changes
- 20–30 seconds continuous movement
- finger stops suddenly
- edge-to-edge movement

## Important Cursor Test

If the finger stops at:

```text
X
```

the desktop laser must settle at:

```text
X
```

almost immediately.

It must **not** continue traveling through stale historical positions.

## Hide / Wake

- stop movement
- wait 4+ seconds
- verify cursor hides
- touch again
- verify cursor appears immediately
- confirm cursor node was not recreated repeatedly

## Click

- tap while cursor is stationary
- tap while cursor recently moved
- rapid click tests

## Scroll

- two-finger scroll slowly
- fast scrolling
- long continuous scroll
- ensure delta is not incorrectly lost

## Media Controls During Pointer Activity

While moving pointer continuously:

- Play
- Pause
- Seek backward
- Seek forward
- Next
- Previous
- Mute
- Volume
- Fullscreen

No button should remain indefinitely loading.

## Playback Stress

Repeat pointer tests:

- while video is playing
- while paused
- while renderer is busy

## Connection

- disconnect
- reconnect
- mobile background
- mobile foreground
- desktop reconnect

## Network

If available:

- 5 GHz Wi-Fi
- 2.4 GHz Wi-Fi
- congested network

---

# Phase 13: Security Regression

The optimization must not weaken Smart Connect v3.

Verify:

- WSS still enabled
- TLS still enabled
- certificate/fingerprint pinning still enabled
- private LAN restriction still enabled
- connection tickets still required
- device identity still required
- connection ID still validated
- sequence validation still works
- Android secure key handling unchanged
- port 8924 unchanged
- no unauthenticated second socket created

## Rule

Improve scheduling, not trust boundaries.

---

# Phase 14: Final Cleanup

Only after all tests pass.

Remove code that became truly obsolete due to the new realtime pipeline.

Do not perform broad cleanup.

## Allowed

- remove obsolete cursor timeout logic
- remove redundant direct cursor IPC path
- add concise comments
- rename newly introduced internal variables if necessary

## Not Allowed

- folder restructuring
- unrelated refactoring
- protocol renaming
- dependency upgrades
- unrelated UI changes
- TypeScript conversions of unrelated JS
- security rewrites

---

# Recommended Execution Order for Gemini 3.6 Flash

Do **not** give Gemini the entire project and tell it:

> "Fix the latency."

Instead execute phases incrementally.

Recommended order:

```text
Phase 0
↓
Phase 1
↓
Phase 2
↓
TEST
↓
Phase 3
↓
TEST
↓
Phase 5
↓
TEST
↓
Phase 6
↓
Phase 7
↓
Phase 8
↓
TEST
↓
Phase 10
↓
Phase 11
↓
FULL REGRESSION
↓
Phase 13 SECURITY REGRESSION
↓
Phase 14 CLEANUP
```

Conditional:

```text
Phase 4 = only if useful / supported
Phase 9 = only after latency is genuinely fixed
```

---

# Required Behavior After Every Phase

Gemini must stop and report:

## Files Changed

Example:

```text
Modified:
- useConnectController.ts
- secureConnectClient.ts
```

## Exact Behavior Changed

Example:

```text
cursor_move now stores only one pending latest position.
Superseded unsent cursor positions are discarded.
```

## What Was Not Changed

Example:

```text
No changes to:
- TLS
- pairing
- authentication
- protocol version
```

## Risks

Example:

```text
Potential risk:
cursor update frequency may decrease under extreme network backpressure,
but latest position remains authoritative.
```

## Tests Performed

Example:

```text
- TypeScript compilation
- Android native build
- pointer movement
- play/pause during continuous pointer movement
```

Do not let Gemini move to the next phase until the previous phase is reviewed.

---

# Architectural Target

```text
                  SMART CONNECT v3

          ┌─────────────────────────────┐
          │       RELIABLE LANE         │
          │                             │
Button ──→│ Secure WSS → Execute → ACK │
          │                             │
          │ Never sacrificed by cursor │
          └─────────────────────────────┘


          ┌─────────────────────────────────────┐
          │          REALTIME LANE              │
          │                                     │
Finger ──→│ newest X/Y → WSS → newest X/Y     │
          │                      ↓              │
          │                    RAF              │
          │                      ↓              │
          │                    Laser            │
          │                                     │
          │ old positions are disposable       │
          │ no historical backlog              │
          └─────────────────────────────────────┘
```

---

# Most Important Rule for Antigravity

> **Never process historical cursor movement just because it arrived. For `cursor_move`, newest state always wins. For reliable actions, every accepted command must reach a terminal ACK, error, socket-failure, or timeout state.**

---

# Expected Final Result

After implementation:

## Laser

- closely follows finger
- no long trailing
- no catch-up path after finger stops
- no stale pointer history
- cursor hide/show does not cause repeated DOM churn

## Reliable Controls

- Play/Pause remains responsive
- Seek remains responsive
- Click remains reliable
- no indefinite loading after continuous usage
- pointer traffic cannot consume reliable command capacity

## Smart Connect Security

Remains unchanged:

```text
TLS
WSS
Certificate Pinning
Device-Bound Trust
Authentication Tickets
Private LAN Enforcement
Secure Sessions
Protocol v3
```

The fix should make Smart Connect **faster without making it weaker**.
