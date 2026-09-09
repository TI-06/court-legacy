from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"anchor not found: {path}\n{old}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"anchor not found: {path}\n{old}")
    file.write_text(text.replace(old, new), encoding="utf-8")


for path in [
    "tests/unit/app/GameAppActions.test.tsx",
    "tests/unit/app/GameApp.pvp.test.tsx",
    "tests/unit/app/GameApp.officialTournament.test.tsx",
    "tests/unit/app/GameApp.officialTournamentRetry.test.tsx",
]:
    replace_all(path, 'name: "この編成で試合開始"', 'name: "この編成・戦術で試合開始"')

replace_once(
    "tests/unit/app/GameAppActions.test.tsx",
    'action: { type: "advance-week", matchSelection: expect.any(Object) },',
    '''action: {
        type: "advance-week",
        matchSelection: expect.any(Object),
        matchTactics: expect.any(Object),
      },''',
)

replace_once(
    "tests/unit/app/GameApp.officialTournament.test.tsx",
    'action: { type: "advance-week", matchSelection: expect.any(Object) },',
    '''action: {
        type: "advance-week",
        matchSelection: expect.any(Object),
        matchTactics: expect.any(Object),
      },''',
)

replace_once(
    "tests/unit/app/GameApp.officialTournamentRetry.test.tsx",
    'action: { type: "advance-week", matchSelection: expect.any(Object) },',
    '''action: {
        type: "advance-week",
        matchSelection: expect.any(Object),
        matchTactics: expect.any(Object),
      },''',
)

replace_once(
    "tests/unit/app/GameApp.pvp.test.tsx",
    '''  currentWinStreak: 3,
};''',
    '''  currentWinStreak: 3,
  tactics: {
    serve: "aggressive",
    attack: "quick",
    block: "read",
  },
};''',
)
replace_once(
    "tests/unit/app/GameApp.pvp.test.tsx",
    '''    expect(mocks.challengePvpTeam).not.toHaveBeenCalled();
    startPreparedPvpMatch();''',
    '''    expect(mocks.challengePvpTeam).not.toHaveBeenCalled();
    expect(screen.getByText("サーブ 強気")).toBeVisible();
    expect(screen.getByText("攻撃 高速")).toBeVisible();
    expect(screen.getByText("ブロック リード")).toBeVisible();
    startPreparedPvpMatch();''',
)
replace_once(
    "tests/unit/app/GameApp.pvp.test.tsx",
    '''      matchSelection: expect.any(Object),
    });''',
    '''      matchSelection: expect.any(Object),
      matchTactics: expect.any(Object),
    });''',
)

replace_once(
    "tests/unit/features/pvp/PvpScreen.test.tsx",
    '''  currentWinStreak: 3,
};''',
    '''  currentWinStreak: 3,
  tactics: {
    serve: "aggressive",
    attack: "quick",
    block: "read",
  },
};''',
)
replace_once(
    "tests/unit/features/pvp/PvpScreen.test.tsx",
    '''    expect(screen.getByText("12勝 7敗")).toBeVisible();
    expect(screen.getByText("勝利")).toBeVisible();''',
    '''    expect(screen.getByText("12勝 7敗")).toBeVisible();
    expect(screen.getByText("サーブ 強気")).toBeVisible();
    expect(screen.getByText("攻撃 高速")).toBeVisible();
    expect(screen.getByText("ブロック リード")).toBeVisible();
    expect(screen.getByText("勝利")).toBeVisible();''',
)
replace_once(
    "tests/unit/features/pvp/PvpScreen.test.tsx",
    '''  it("renders defender history with the viewer score first", () => {''',
    '''  it("does not guess tactics for a legacy opponent", () => {
    const legacyOpponent = { ...opponent };
    delete legacyOpponent.tactics;

    renderScreen({ opponents: [legacyOpponent], result: null });

    expect(screen.getByText("戦術傾向 非公開")).toBeVisible();
  });

  it("renders defender history with the viewer score first", () => {''',
)
