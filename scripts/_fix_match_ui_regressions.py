from pathlib import Path

panels = Path("src/features/match/MatchStatPanels.tsx")
text = panels.read_text()
old = '''  const user = userIsHome ? summary.home : summary.away;
  const opponent = userIsHome ? summary.away : summary.home;
  const mvpTeamName = teamNameFor('''
new = '''  const user = userIsHome ? summary.home : summary.away;
  const opponent = userIsHome ? summary.away : summary.home;
  const userName = userIsHome ? homeName : awayName;
  const opponentName = userIsHome ? awayName : homeName;
  const mvpTeamName = teamNameFor('''
if text.count(old) != 1:
    raise SystemExit("MatchStatPanels summary insertion point changed")
text = text.replace(old, new, 1)
old = '''          <div className="match-box-score__header">
            <strong>あなた</strong>
            <span>項目</span>
            <strong>相手</strong>
          </div>'''
new = '''          <div className="match-box-score__header">
            <strong>{userName}</strong>
            <span>項目</span>
            <strong>{opponentName}</strong>
          </div>'''
if text.count(old) != 1:
    raise SystemExit("MatchStatPanels box score header changed")
panels.write_text(text.replace(old, new, 1))

flow = Path("tests/unit/features/match/MatchFlow.test.tsx")
text = flow.read_text()
old = '''    const homeCard = screen.getByText("自校").closest("article");
    const awayCard = screen.getByText("相手").closest("article");'''
new = '''    const versusCard = screen.getByRole("region", { name: "対戦カード" });
    const homeCard = within(versusCard).getByText("自校").closest("article");
    const awayCard = within(versusCard).getByText("相手").closest("article");'''
if text.count(old) != 1:
    raise SystemExit("MatchFlow versus-card assertion changed")
text = text.replace(old, new, 1)
old = '''    expect(screen.getAllByText("セット 0")).toHaveLength(2);'''
new = '''    expect(screen.getAllByText(/セット 0 ・ 戦力 \\d+/)).toHaveLength(2);'''
if text.count(old) != 1:
    raise SystemExit("MatchFlow set-score assertion changed")
flow.write_text(text.replace(old, new, 1))
