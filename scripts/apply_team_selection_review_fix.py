from pathlib import Path


def update_test() -> None:
    path = Path("tests/unit/domain/team/autoSelectTeam.test.ts")
    text = path.read_text(encoding="utf-8")
    if "benches an injured locked libero" in text:
        return

    marker = '  it("does not mutate the supplied selection", () => {'
    test_case = '''  it("benches an injured locked libero when injury exceptions are enabled", () => {
    const { state, school } = prepareRoleRoster();
    const base = autoSelectTeam({ state, schoolId: school.id });
    const lockedId = base.liberoPlayerId!;
    state.players[lockedId] = {
      ...state.players[lockedId]!,
      injury: {
        injuryId: "injury.knee",
        severity: "moderate",
        remainingWeeks: 4,
        recurrenceRisk: 25,
      },
    };

    const result = resolveLockedStarters({
      state,
      schoolId: school.id,
      selection: {
        ...base,
        substitutionPolicy: {
          ...base.substitutionPolicy,
          starterLockPlayerIds: [lockedId],
          allowInjuryBenching: true,
        },
      },
    });

    expect(result.selection.liberoPlayerId).not.toBe(lockedId);
    expect(result.selection.benchPlayerIds).toContain(lockedId);
    expect(result.replacements).toContainEqual(
      expect.objectContaining({ playerId: lockedId, reason: "injury" }),
    );
  });

'''
    if marker not in text:
        raise RuntimeError("test insertion marker not found")
    path.write_text(text.replace(marker, test_case + marker, 1), encoding="utf-8")


def update_source() -> None:
    path = Path("src/domain/team/autoSelectTeam.ts")
    text = path.read_text(encoding="utf-8")

    if "function swapLiberoPlayer(" not in text:
        marker = "function eligibleReplacementCandidates(\n"
        helper = '''function swapLiberoPlayer(
  selection: TeamSelection,
  outgoingPlayerId: PlayerId,
  incomingPlayerId: PlayerId,
): void {
  if (selection.liberoPlayerId !== outgoingPlayerId) {
    throw new Error(`libero player not found: ${outgoingPlayerId}`);
  }

  selection.liberoPlayerId = incomingPlayerId;
  selection.benchPlayerIds = selection.benchPlayerIds
    .filter((playerId) => playerId !== incomingPlayerId)
    .concat(outgoingPlayerId);
}

'''
        if marker not in text:
            raise RuntimeError("helper insertion marker not found")
        text = text.replace(marker, helper + marker, 1)

    old_block = '''  for (const lockedId of lockedIds) {
    const assignment = selection.rotation.find(
      (item) => item.playerId === lockedId,
    );
    if (!assignment) {
      continue;
    }
    const player = input.state.players[lockedId];
    if (!player) {
      continue;
    }
    const reason = safetyReason(player, selection);
    if (!reason) {
      continue;
    }

    const candidates = eligibleReplacementCandidates(
      input.state,
      selection,
      lockedIds,
    );
    if (candidates.length === 0) {
      continue;
    }
    const replacement = stableBest(candidates, player.preferredPosition);
    swapRotationPlayer(selection, lockedId, replacement.id);
    replacements.push({
      playerId: lockedId,
      replacementPlayerId: replacement.id,
      reason,
    });
  }
'''
    new_block = '''  for (const lockedId of lockedIds) {
    const isRotationPlayer = selection.rotation.some(
      (item) => item.playerId === lockedId,
    );
    const isLibero = selection.liberoPlayerId === lockedId;
    if (!isRotationPlayer && !isLibero) {
      continue;
    }
    const player = input.state.players[lockedId];
    if (!player) {
      continue;
    }
    const reason = safetyReason(player, selection);
    if (!reason) {
      continue;
    }

    const candidates = eligibleReplacementCandidates(
      input.state,
      selection,
      lockedIds,
    );
    if (candidates.length === 0) {
      continue;
    }
    const replacement = stableBest(
      candidates,
      isLibero ? "L" : player.preferredPosition,
    );
    if (isLibero) {
      swapLiberoPlayer(selection, lockedId, replacement.id);
    } else {
      swapRotationPlayer(selection, lockedId, replacement.id);
    }
    replacements.push({
      playerId: lockedId,
      replacementPlayerId: replacement.id,
      reason,
    });
  }
'''
    if old_block not in text:
        if new_block in text:
            path.write_text(text, encoding="utf-8")
            return
        raise RuntimeError("locked starter replacement block not found")

    path.write_text(text.replace(old_block, new_block, 1), encoding="utf-8")


update_test()
update_source()
