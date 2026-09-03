from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_required(path: str, old: str, new: str, count: int | None = None) -> None:
    text = read(path)
    actual = text.count(old)
    if actual == 0:
        raise RuntimeError(f"missing replacement in {path}: {old[:100]!r}")
    if count is not None and actual != count:
        raise RuntimeError(f"unexpected replacement count in {path}: {actual} != {count}")
    write(path, text.replace(old, new))


# TeamScreen: keep role/aptitude/overall readable on 320-480px courts.
replace_required(
    "src/features/team/TeamScreen.tsx",
    '''                      <span>
                        本職 {player.preferredPosition}・適性
                        {
                          player.positionAptitudes[
                            ROTATION_ROLES[assignment.slot]
                          ]
                        }
                        ・総合{playerOverall(player)}
                      </span>''',
    '''                      <span>
                        本{player.preferredPosition} 適
                        {
                          player.positionAptitudes[
                            ROTATION_ROLES[assignment.slot]
                          ]
                        } 総{playerOverall(player)}
                      </span>''',
    1,
)

team_css_path = "src/features/team/team-direct.css"
team_css = read(team_css_path)
anchor = '''.court-player-button > span:last-child {
  overflow: hidden;
  color: #62757e;
  font-size: 12px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}'''
replacement = '''.court-player-button > span:last-child {
  overflow: hidden;
  color: #62757e;
  font-size: 11px;
  line-height: 1.2;
  overflow-wrap: anywhere;
  white-space: normal;
}'''
if team_css.count(anchor) != 1:
    raise RuntimeError("court player metadata style marker missing")
write(team_css_path, team_css.replace(anchor, replacement))

# When already inside the Player tab's Team State subview, tapping the bottom Player tab
# does not remount the hub. Return to the internal roster tab before opening training.
replace_required(
    "tests/e2e/team-dynamics-flow.spec.ts",
    '''  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.locator(".player-training-chip").first().click();''',
    '''  await page.getByRole("button", { name: "選手一覧", exact: true }).click();
  await page.locator(".player-training-chip").first().click();''',
    1,
)

# OperationBlockingOverlay intentionally adds a second role=status while mutations run.
# E2E assertions that mean the persistent header status should target it explicitly.
for path in [
    "tests/e2e/app-shell.spec.ts",
    "tests/e2e/v2-auth-game-flow.spec.ts",
    "tests/e2e/team-dynamics-flow.spec.ts",
    "tests/e2e/phase10-notifications.spec.ts",
    "tests/e2e/event-dialog.spec.ts",
    "tests/e2e/v2-operation-feedback.spec.ts",
]:
    text = read(path)
    old = 'page.getByRole("status")'
    if old in text:
        write(path, text.replace(old, 'page.locator(".operation-status")'))

print("Phase 12 E2E follow-up fixes applied")
