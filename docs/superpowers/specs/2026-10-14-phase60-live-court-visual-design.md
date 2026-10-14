# Phase60-1 — Lightweight live court playback

## Motivation

The existing PVE/PVP match view consists of a scoreboard and text event stream. Match actions are already authoritative and include serve, receive, attack, block and point events. Animation should give the match visual feedback **without** changing the simulation or save protocol.

## Phase60-1 implementation

- Render a compact, top-down SVG volleyball court in the live match area, immediately after the scoreboard.
- Use the existing home/away match selections for six silhouettes (numbered rotation markers) per side.
- Read only the currently revealed event and its preceding action within the same set. Never reveal future events.
- Display the associated serve, spike, block or reception moment.
- Animate the ball toward the other side of the net only while the currently visible segment is playing.
- Honor reducedMotion and OS-level prefers-reduced-motion.
- Hide the court in text/instant modes to preserve existing flow and fast-play preference.
- Preserve skip-to-result, coach commands and existing event timeline.
- Render-only React/CSS. No game action, additional network call, schema update, storage, saved animation timeline or new dependency.

## Limitations

This first slice is a schematic visualization of the real event sequence, not frame-accurate player tracking or a realtime physical simulation. Positions are tactical markers, not reconstructed in-rally movements.

## Gates

1. Existing match playback tests remain green, including decision/skip and match end.
2. New deterministic event-to-court tests.
3. Match result/privacy tests unchanged.
4. Responsive at 320px and higher; no horizontal clipping.
5. 10/30-year save and event-stream invariants remain intact.
