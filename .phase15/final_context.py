from pathlib import Path

path = Path("docs/PROJECT_CONTEXT.md")
text = path.read_text(encoding="utf-8")
text = text.replace(
    "**Phase 15 — Team Tactics is the next roadmap slice.**",
    "Phase 15 is complete. **Phase 16 — Match Command is the next roadmap slice.**",
)
text = text.replace(
    "### Phase 15 — Team Tactics\n\nSimple meaningful volleyball tactics, with opponent matchup trade-offs and no single dominant strategy.",
    """### Phase 15 — Team Tactics\n\nPhase 15 adds a compact three-axis tactics layer without adding repetitive micromanagement:\n\n- persistent basic tactics in Player Hub for serve (`安全重視 / バランス / 強気`), attack (`サイド重視 / バランス / 高速`) and block (`コミット / ミックス / リード`);\n- server-authoritative `set-team-tactics` persistence while keeping save schema v8;\n- match-only tactic overrides in pre-match that never overwrite the saved basic tactics;\n- explicit attack/block matchup trade-offs with no unconditional best block or defense choice;\n- serve risk/reward where aggressive serving raises both pressure/upside and error risk;\n- PvE opponent tendencies derived only from known school tactics;\n- PvP public tactic summaries limited to the three categorical team tendencies, with legacy summaries shown as `戦術傾向 非公開`;\n- no opponent individual abilities, player IDs or `serveTargetPlayerId` exposed;\n- mobile coverage at 320 / 360 / 390 / 414 / 480 px for Player Hub tactics and pre-match match-only tactics.\n\nPhase 15 intentionally does not add per-point tactical commands; those belong to Phase 16.""",
)
text = text.replace(
    "### Phase 14\n\n- `docs/superpowers/specs/2026-09-09-phase14-player-hub-2-design.md`\n- `docs/superpowers/plans/2026-09-09-phase14-player-hub-foundation.md`\n- `docs/superpowers/plans/2026-09-09-phase14-player-hub-ui.md`\n- `docs/superpowers/plans/2026-09-09-phase14-saved-lineup-ux.md`",
    """### Phase 14\n\n- `docs/superpowers/specs/2026-09-09-phase14-player-hub-2-design.md`\n- `docs/superpowers/plans/2026-09-09-phase14-player-hub-foundation.md`\n- `docs/superpowers/plans/2026-09-09-phase14-player-hub-ui.md`\n- `docs/superpowers/plans/2026-09-09-phase14-saved-lineup-ux.md`\n\n### Phase 15\n\n- `docs/superpowers/specs/2026-09-09-phase15-team-tactics-design.md`\n- `docs/superpowers/plans/2026-09-09-phase15-team-tactics-foundation.md`\n- `docs/superpowers/plans/2026-09-09-phase15-tactics-ux.md`""",
)
path.write_text(text, encoding="utf-8")
