from pathlib import Path

context_path = Path("docs/PROJECT_CONTEXT.md")
context = context_path.read_text()
context = context.replace(
    "Phase 15 is complete. **Phase 16 — Match Command is in progress with PR16-1 and PR16-2 complete.**",
    "Phase 15 and Phase 16 are complete through PR16-3. **Phase 17 — Season Goals & Rankings is next.**",
    1,
)
old_tail = """PR16-2 intentionally keeps official-tournament interactive finalization and asynchronous PvP match-command sessions out of scope. **PR16-3 Official/PvP Completion is the next Phase 16 slice.**
"""
new_tail = """PR16-3 Official/PvP Completion completes Phase 16 with:

- official tournament matches using the same authoritative resumable Match Command flow, with bracket/history progression only after match completion;
- asynchronous rated PvP backed by server-private persisted match sessions, so defender snapshots, runtime, private player IDs and abilities never enter public responses;
- deterministic server-owned defender coaching while the challenger remains the only human-controlled side;
- authenticated PvP start/status/command routes with sanitized public segments and command-id replay/idempotency;
- network-ambiguity recovery through authoritative status before retry, preserving the same command ID when the server state is unchanged;
- final PvP rating/history still committed only through the existing atomic `commit_pvp_rated_match` authority;
- official and PvP MatchScreen integration with match-local lineup/tactics that never overwrite persistent team state;
- 320 / 360 / 390 / 414 / 480 px official/PvP E2E coverage, including bounded decisions, status recovery, finalization timing and horizontal-overflow checks;
- save schema remaining v8.

Phase 16 is complete. Phase 17 is the next roadmap slice.
"""
assert old_tail in context
context = context.replace(old_tail, new_tail, 1)
context_path.write_text(context)

plan_path = Path("docs/superpowers/plans/2026-09-10-phase16-official-pvp-completion.md")
plan = plan_path.read_text()
task6_marker = "### Task 6: Five-width E2E, final privacy review, and Phase 16 completion"
assert task6_marker in plan
before_task6, task6 = plan.split(task6_marker, 1)
before_task6 = before_task6.replace("- [ ]", "- [x]")
step6_marker = "- [ ] **Step 6: Final diff review.**"
assert step6_marker in task6
task6_done, task6_remaining = task6.split(step6_marker, 1)
task6_done = task6_done.replace("- [ ]", "- [x]")
plan = before_task6 + task6_marker + task6_done + step6_marker + task6_remaining
plan_path.write_text(plan)
