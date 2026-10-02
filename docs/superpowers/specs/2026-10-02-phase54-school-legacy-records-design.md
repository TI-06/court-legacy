# Phase54 School Legacy Records Design

Date: 2026-10-02

## Goal

Make long-term school history visible without adding another permanent history payload.

## Data source

Use only data already persisted:

- active user-school players from Player.career
- user-school graduates from GameState.history.graduates

No new schema field is introduced.

## UX

Reuse the existing 今季成績 BottomSheet.

Add a compact segmented control:

- 今季
- 歴代

歴代 shows top five for:

- 出場試合
- 通算得点
- 通算ブロック
- サービスエース

Active players can open their current record detail.
Graduates are display-only so the UI does not present them as active roster members.

## Performance

The list is derived only when Player Hub state changes.
Expected source size is bounded by the existing roster plus existing graduate history.
No match simulation or server request is added.
