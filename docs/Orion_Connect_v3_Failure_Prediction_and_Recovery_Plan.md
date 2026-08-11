# Orion Connect v3 Failure Prediction & Recovery Plan

**Target reviewer:** Antigravity using Claude Opus 4.6  
**Project:** Orion Connect / Smart Connect v3  
**Purpose:** Diagnose the persistent Touch Pad / laser lag and reliable-control loading problem using the current post-change architecture.

---

# 1. Current Situation

The previous optimization attempts produced little or no meaningful real-device improvement.

Current observed behavior:

- The **Touch Pad is dramatically worse than the other controls**.
- The laser cursor is still very laggy and does not stay naturally synchronized with finger movement.
- A continuous gesture may feel as if only part of the movement is accepted.
- Normal controls such as Play/Pause/Seek can still enter a **Loading** state after continued use.
- UI hit-area syncing and ScrollView gesture-isolation changes did **not** solve the real-device issue.
- Unit tests are passing, but the real Android + WSS + Electron path remains unhealthy.

This strongly suggests that the primary failure is now deeper than simple sensitivity or visible Touch Pad layout.

---

# 2. Important Facts From the Current Diagnostic

## 2.1 Cursor Movement Is Sent Immediately for Every Touch Event

Current `useRemotePointer.ts` behavior effectively does:

```ts
onPanResponderMove(...) {
    ...
    sendRef.current('cursor_move', { x, y });
}
```

There is currently no demonstrated pre-network latest-state scheduler in the diagnostic.

That means raw touch movement can become high-frequency network traffic.

---

## 2.2 Native Realtime Sender Sends Immediately

Current Android native path:

```kotlin
@ReactMethod
fun sendRealtimeSocketFireAndForget(payload: String) {
    socket?.send(payload)
}
```

This is simple and low overhead, but it provides no application-level protection against a high-frequency stream creating outbound queue pressure.

---

## 2.3 Desktop Main Forwards Every Cursor Packet to Electron IPC

Current Desktop Main behavior:

```js
if (action === 'cursor_move' || action === 'scroll') {
    const command = normalizeCommand(envelope.payload);
    notifyDesktopRenderer("orion:remote-command", command);
    return;
}
```

This means cursor packets are not being meaningfully coalesced **before Electron IPC**.

---

## 2.4 Coalescing Happens Too Late

The Desktop Renderer does use a `latestCursorPayload` with `requestAnimationFrame`.

This is good for rendering.

However, by the time Renderer coalescing happens, each raw cursor update may already have passed through:

```text
React Native gesture
→ JS command creation
→ Native bridge
→ OkHttp WebSocket
→ WSS/TCP
→ Desktop WebSocket parser
→ security checks
→ rate checks
→ Electron IPC
→ Renderer
```

Therefore, renderer-only coalescing cannot protect the expensive upstream pipeline from being flooded.

---

## 2.5 Sequence Validation Is Monotonic, Not Contiguous

The server accepts a sequence when:

```text
sequence > lastSequence
```

It does **not** require:

```text
previous + 1
```

Therefore sequence gaps caused by intentional cursor coalescing are safe.

Example:

```text
100 accepted
101 discarded before send
102 discarded before send
105 sent
```

`105` is valid because it is newer than `100`.

---

## 2.6 Out-of-Order Delivery Is Still Dangerous

Although sequence gaps are valid, this remains unsafe:

```text
cursor sequence 104 arrives first
reliable Play sequence 103 arrives afterward
```

The server would accept 104 and reject 103 as:

```text
STALE_SEQUENCE
```

Therefore realtime and reliable traffic must not introduce sequence reordering.

---

## 2.7 Reliable Commands Wait Up to 2200 ms for ACK

Reliable controls create a pending ACK lifecycle.

If ACK is delayed, lost, or the command is rejected without immediately terminating the pending state, Mobile can show a loading state until timeout.

This is consistent with the user's observation that other controls still occasionally load after continued usage.

---

# 3. Primary Prediction

## Prediction #1: Upstream Cursor Flooding / Queue Pressure

**Confidence: High**

The strongest current hypothesis is:

> Raw Touch Pad movement is being sent too aggressively through the complete Smart Connect v3 transport pipeline, while meaningful latest-state coalescing happens only at the Renderer.

This could create pressure in one or more of:

- React Native bridge scheduling
- OkHttp WebSocket outbound queue
- TCP/WSS buffers
- Desktop Node.js WebSocket event processing
- security/replay validation path
- command rate limiter
- Electron `webContents.send()`
- Renderer IPC event queue

The Touch Pad suffers the most because it generates much more traffic than a button.

This explains the pattern:

```text
Touch Pad
→ extremely bad

Normal buttons
→ initially better
→ eventually loading / delayed
```

---

# 4. Secondary Prediction

## Prediction #2: Reliable Commands Are Being Delayed or Rejected While Realtime Traffic Is Active

**Confidence: Medium-High**

Possible sequence:

```text
Touch Pad generates heavy realtime traffic
        ↓
Realtime packet receives a newer sequence number
        ↓
Reliable command is transmitted later / delivered out of order
        ↓
Desktop sees reliable sequence <= lastSequence
        ↓
STALE_SEQUENCE
        ↓
Mobile waits for ACK or error handling is incomplete
        ↓
Loading...
```

This must be verified with actual runtime counters and rejection logs.

---

# 5. Secondary Prediction

## Prediction #3: Command Errors Are Not Immediately Resolving Pending ACK State

**Confidence: Medium**

Desktop can return errors such as:

```text
COMMAND_RATE_LIMITED
STALE_SEQUENCE
DUPLICATE_COMMAND
```

A reliable UI action should treat any of these as a terminal response.

Correct behavior:

```text
command sent
↓
server error received
↓
pending ACK removed immediately
↓
loading ends immediately
↓
error surfaced/recovered
```

Incorrect behavior:

```text
command sent
↓
server error received
↓
pending ACK still waits
↓
2.2 second timeout
↓
Loading...
```

The complete Mobile error-envelope handling should be inspected.

---

# 6. What Is Probably NOT the Primary Root Cause Anymore

Based on failed real-device testing, do not spend another broad pass on these unless runtime diagnostics prove otherwise:

- Touch Pad visible UI size
- hardcoded old `0.002` sensitivity
- Trackpad vs 1:1 Direct mapping
- basic ScrollView responder isolation
- laser CSS
- cursor centering
- generic LERP/smoothing
- simply increasing command rate limits
- simply removing more timers
- simply reducing TLS/security

These may contain minor issues, but they did not explain the persistent failure after the recent changes.

---

# 7. Critical Architecture Principle

The realtime pointer lane must follow:

```text
Capture fast
→ keep latest state
→ transmit at controlled rate
→ discard superseded unsent states
→ never build pointer history
```

NOT:

```text
Capture fast
→ send everything
→ queue everything
→ coalesce only at final renderer
```

For `cursor_move`:

> **Latest state wins.**

For reliable controls:

> **Every accepted action must reach a terminal ACK, error, socket failure, or timeout state.**

---

# 8. Required Diagnostic Work Before Another Major Refactor

Do not immediately rewrite the transport again.

First add measurable runtime instrumentation.

## 8.1 Counters Required

Collect actual values for:

```text
touch_generated_count
realtime_sent_count
native_realtime_send_count
ws_received_count
sequence_rejected_count
rate_rejected_count
ipc_forwarded_count
rendered_frame_count

reliable_sent_count
ack_received_count
ack_error_count
ack_timeout_count
```

Optional if available:

```text
okhttp_websocket_queue_bytes
desktop_ws_buffered_amount
electron_ipc_cursor_flush_count
```

---

## 8.2 Test Procedure

On a real Android device:

### Test A

Move finger aggressively on Touch Pad for 10 seconds.

Then record all counters.

### Test B

Move finger aggressively for 10 seconds while repeatedly pressing:

- Play/Pause
- Seek
- Mute
- Volume

Then record all counters again.

### Test C

Stop finger instantly after rapid movement.

Observe whether the desktop cursor:

```text
stops immediately
```

or:

```text
continues finishing old movement
```

If it continues after finger stops, stale state is definitely queued somewhere.

---

# 9. Counter Interpretation Guide

## Case A: Mobile Sender Problem

```text
touch_generated = 1200
realtime_sent = 200
```

Likely problem:

- Mobile realtime scheduler
- JS/native bridge
- send-state latch
- realtime send path

---

## Case B: Native / Network Queue Problem

```text
touch_generated = 1200
realtime_sent = 1150
ws_received = 350
```

Likely problem:

- native OkHttp outbound pressure
- socket queue
- Wi-Fi / TCP buffering
- transport-level congestion

---

## Case C: Desktop Main / Security / Rate Problem

```text
realtime_sent = 1100
ws_received = 1080
ipc_forwarded = 300
sequence_rejected = high
rate_rejected = high
```

Likely problem:

- replay/sequence ordering
- rate limiter
- Desktop Main event pressure
- rejection logic

---

## Case D: Electron IPC Problem

```text
ws_received = 1000
ipc_forwarded = 950
rendered_frame = 250
```

Possible problem:

- Electron renderer event pressure
- IPC backlog
- renderer scheduling

Renderer-side `latestCursorPayload` may reduce visual work but cannot erase IPC history that has already arrived.

---

## Case E: Reliable Command Problem

```text
reliable_sent = 20
ack_received = 8
ack_error = 3
ack_timeout = 9
```

This confirms reliable command lifecycle failure.

Then inspect each timed-out command against:

```text
sequence rejection
rate rejection
server dispatch
ACK send
mobile message parsing
```

---

# 10. Recommended Real Fix if Upstream Flooding Is Confirmed

## Phase 1: Mobile Latest-State Scheduler

Do not call native WebSocket send directly for every raw pointer move.

Maintain:

```ts
latestCursor
cursorFlushScheduled
```

Raw touch:

```ts
latestCursor = newestCoordinates;
```

A controlled flush loop sends only the latest value.

Recommended initial transport rate:

```text
60 Hz
```

This is not a crude event-dropping throttle.

It is **latest-state scheduling**.

Example:

```text
Raw touch:
A B C D E

Before next transport tick:
latest = E

Send:
E
```

---

# 11. Important Sequence Rule

Do not allocate the cursor command sequence when raw movement is captured.

Allocate the sequence **when the coalesced cursor packet is actually being transmitted**.

Correct:

```text
Touch A
Touch B
Touch C
Touch D

latest state = D

transport tick:
sequence = 501
send D as sequence 501
```

This avoids wasting sequence values on states that never leave the device and reduces opportunities for cross-lane ordering confusion.

---

# 12. Recommended Mobile Realtime Flow

Conceptual design:

```ts
function onCursorMove(position) {
    latestCursorRef.current = position;
    ensureCursorFlushLoop();
}

function flushCursor() {
    const latest = latestCursorRef.current;

    if (latest) {
        latestCursorRef.current = null;

        const sequence = nextSequence();
        sendRealtimeCursor(latest, sequence);
    }

    scheduleNextFlushIfNeeded();
}
```

Requirements:

- one scheduler only
- no arrays
- no pointer queue
- no Promise chain per raw touch
- no retries for stale cursor state
- latest coordinates overwrite old unsent coordinates

---

# 13. Desktop Main Must Also Coalesce Before Electron IPC

Even with Mobile coalescing, Desktop Main should protect Electron IPC.

Instead of:

```js
notifyDesktopRenderer(...cursor...)
```

for every received cursor packet:

```text
latestDesktopCursor = newest packet
```

Then flush to Renderer at a maximum controlled rate.

Example:

```text
WSS receives:
A
B
C
D

Before next IPC flush:
latestDesktopCursor = D

Electron IPC sends:
D
```

This prevents IPC backlog if Desktop or Renderer temporarily stalls.

---

# 14. Do Not Coalesce Scroll the Same Way as Cursor Position

Cursor coordinates are **absolute state**.

Scroll is normally **delta state**.

Example:

```text
scroll +5
scroll +8
scroll -3
```

Blindly keeping only the last scroll delta would lose movement.

Instead either:

```text
accumulate scroll deltas
```

or keep scroll on a separately controlled path.

Do not treat `scroll` exactly like `cursor_move`.

---

# 15. Reliable Lane Must Remain Protected

Reliable actions should not share a fragile realtime queue.

Conceptual structure:

```text
REALTIME LANE
cursor_move
latest-state
droppable
no ACK

RELIABLE LANE
play
pause
click
seek
mute
volume
ordered
ACK required
terminal outcome required
```

Realtime load must not block reliable actions.

---

# 16. Revisit Sequence Ownership

Because Smart Connect v3 currently uses one monotonic sequence domain, ensure the actual send order matches sequence allocation order.

Possible safe approaches:

## Option A: Single Serialized Envelope Dispatcher

Both realtime and reliable sends pass through one lightweight dispatcher that allocates sequence numbers immediately before socket send.

Benefits:

- preserves global sequence order
- prevents realtime/reliable reordering
- easy replay semantics

Realtime cursor state can still be coalesced before entering this dispatcher.

### Preferred if implementation complexity remains reasonable.

---

## Option B: Independent Sequence Domains

Only consider this if protocol/security design is intentionally changed.

Would require:

- protocol/schema changes
- server replay logic changes
- compatibility considerations

Do **not** casually implement this during a latency fix.

For now, Option A is safer.

---

# 17. Reliable Error Handling Fix

Inspect Mobile socket message handling.

Any server-side command error must immediately terminate the corresponding pending ACK entry.

Required terminal messages include at least:

```text
ack
COMMAND_RATE_LIMITED
STALE_SEQUENCE
DUPLICATE_COMMAND
connection mismatch
protocol error
socket closed
socket failure
timeout
```

A UI control must never remain loading simply because the server rejected the request.

---

# 18. Local Isolation Tests That Must Be Performed Properly

Previous unit suites do not replace real-device isolation.

## 18.1 Real Mobile Local Pointer Test

On the actual phone:

```text
finger
↓
PanResponder
↓
local dot rendered inside Touch Pad
```

Disable all network sending for this diagnostic mode.

If the local dot follows perfectly:

```text
Mobile gesture/UI path = healthy
```

If the local dot also freezes:

```text
Mobile gesture/UI path still broken
```

---

## 18.2 Real Desktop Synthetic Cursor Test

On Desktop:

```text
requestAnimationFrame
↓
synthetic X/Y movement
↓
same virtual laser DOM
```

No Mobile.
No WSS.
No network.

If smooth:

```text
Renderer/laser DOM = healthy
```

If laggy:

```text
Renderer itself needs investigation
```

---

# 19. What Opus 4.6 Should Inspect First

Before modifying architecture, inspect these exact current post-change files:

### Mobile

```text
apps/mobile/src/features/connect/useRemotePointer.ts
apps/mobile/src/features/connect/useConnectController.ts
apps/mobile/src/features/connect/secureConnectClient.ts
apps/mobile/src/services/nativeSecureConnect.ts
apps/mobile/plugins/orion-nsd-native/OrionSecureConnectModule.kt
```

### Desktop

```text
apps/desktop/src/main/ipc/smartConnectIpc.js
apps/desktop/src/main/smartConnect/secureTrust.js
apps/desktop/src/renderer/app/hooks/useSmartConnectRemoteCommands.js
```

Also inspect:

- Mobile socket-message / error-envelope handler
- pending ACK map implementation
- reliable command loading-state implementation
- current rate-limiter split logic

---

# 20. Instructions for Opus 4.6

Do not assume earlier Gemini-generated fixes are correct merely because tests pass.

Please:

1. Read the current post-change implementation.
2. Compare actual code with this diagnostic hypothesis.
3. Identify whether cursor state is coalesced **before network send**.
4. Identify whether cursor state is coalesced **before Electron IPC**.
5. Inspect actual socket queue/backpressure behavior.
6. Inspect reliable/realtime sequence allocation order.
7. Inspect server rejection → Mobile pending ACK resolution.
8. Add runtime counters before performing another broad refactor.
9. Prefer small reversible changes.
10. Preserve Smart Connect v3 security boundaries.

Do not weaken:

- TLS / WSS
- certificate pinning
- device-bound authentication
- connection IDs
- replay protection
- private-LAN enforcement
- secure tickets
- Android secure key storage

---

# 21. Priority Order

Recommended order:

```text
1. Runtime counters
2. Real Mobile local-pointer isolation test
3. Real Desktop synthetic-pointer isolation test
4. Inspect sequence allocation/send order
5. Inspect ACK error termination
6. Confirm upstream flooding
7. Add Mobile latest-state scheduler
8. Add Desktop Main pre-IPC coalescing
9. Protect reliable lane
10. Re-test real device
11. Only then consider visual smoothing
```

---

# 22. Do Not Do These Yet

Avoid another speculative pass that:

- adds LERP
- adds springs
- changes cursor appearance
- changes Touch Pad sensitivity again
- raises rate limits massively
- disables replay security
- disables TLS
- adds another socket
- rewrites Smart Connect protocol
- changes unrelated Orion UI
- adds heavy logging per pointer packet

Per-event logging can itself worsen latency.

Use aggregated counters.

---

# 23. Expected Healthy Architecture

```text
                     ORION CONNECT v3

MOBILE TOUCH
    │
    ├── raw events can arrive rapidly
    │
    ▼
LATEST CURSOR STATE
    │
    │ old unsent state is replaced
    ▼
CONTROLLED REALTIME FLUSH
    │
    ▼
GLOBAL ORDERED SEND DISPATCHER
    │
    ├── cursor packet
    ├── reliable command
    └── sequence allocated in actual send order
    │
    ▼
SECURE WSS
    │
    ▼
DESKTOP MAIN
    │
    ├── security/replay validation
    ├── realtime/reliable rate protection
    │
    ▼
LATEST CURSOR STATE
    │
    │ old unrendered state replaced
    ▼
CONTROLLED IPC FLUSH
    │
    ▼
RENDERER RAF
    │
    ▼
LASER
```

Reliable commands travel through the same secure connection but retain terminal ACK/error semantics.

---

# 24. Strongest Current Prediction

The current Touch Pad problem is most likely **not a single “latency in milliseconds” issue**.

It is more likely a **traffic-shaping / queue / state-delivery problem**:

> too many raw realtime cursor updates are allowed to enter the expensive Smart Connect pipeline before superseded state is discarded.

That would produce:

- perceived lag
- stale cursor travel
- Touch Pad being much worse than buttons
- transport pressure
- reliable command delays
- occasional ACK timeouts/loading

This prediction must be validated with real runtime counters before being treated as confirmed.

---

# 25. Success Criteria

Do not declare the issue fixed until all of the following pass on a real device:

### Touch Pad

- one continuous finger drag remains active
- laser follows without large visible trailing
- rapid movement for 20–30 seconds does not degrade progressively
- when finger stops, laser stops almost immediately
- no stale movement continues afterward

### Reliable Controls

During continuous pointer use:

- Play/Pause works
- Seek works
- Mute works
- Volume works
- Click works
- no command remains indefinitely Loading
- `ack_timeout_count` remains near zero under healthy LAN conditions
- reliable rate drops remain zero under normal use

### Security

- Smart Connect v3 authentication remains intact
- WSS remains intact
- replay protection remains intact
- no unauthenticated fast-path socket is introduced

---

# Final Principle

> **Realtime cursor movement is state, not history. Keep the newest state and discard superseded unsent state. Reliable controls are actions, not telemetry. Preserve their ordering and guarantee a terminal ACK/error/timeout outcome.**
