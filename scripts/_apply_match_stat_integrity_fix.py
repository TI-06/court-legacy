from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {text.count(old)}")
    path.write_text(text.replace(old, new, 1))


presentation = Path("src/features/match/matchPresentation.ts")
replace_once(
    presentation,
    '''export interface TeamMatchStats {
  schoolId: SchoolId;
  attackPoints: number;
  blockPoints: number;
  serviceAces: number;
  defensePoints: number;
  serveErrors: number;
  attackAttempts: number;
  receiveAttempts: number;
  perfectReceives: number;
  attackSuccessRate: number;
  perfectReceiveRate: number;
}''',
    '''export interface TeamMatchStats {
  schoolId: SchoolId;
  totalPoints: number;
  attackPoints: number;
  blockPoints: number;
  serviceAces: number;
  rallyPoints: number;
  opponentErrorPoints: number;
  serveErrors: number;
  attackAttempts: number;
  receiveAttempts: number;
  perfectReceives: number;
  attackSuccessRate: number;
  perfectReceiveRate: number;
}''',
    "TeamMatchStats",
)
replace_once(
    presentation,
    '''  return {
    schoolId,
    attackPoints: 0,
    blockPoints: 0,
    serviceAces: 0,
    defensePoints: 0,
    serveErrors: 0,
    attackAttempts: 0,
    receiveAttempts: 0,
    perfectReceives: 0,
    attackSuccessRate: 0,
    perfectReceiveRate: 0,
  };''',
    '''  return {
    schoolId,
    totalPoints: 0,
    attackPoints: 0,
    blockPoints: 0,
    serviceAces: 0,
    rallyPoints: 0,
    opponentErrorPoints: 0,
    serveErrors: 0,
    attackAttempts: 0,
    receiveAttempts: 0,
    perfectReceives: 0,
    attackSuccessRate: 0,
    perfectReceiveRate: 0,
  };''',
    "createTeamStats",
)
replace_once(
    presentation,
    '''    if (matchEvent.type !== "point" || !actor || !actorTeam) {
      continue;
    }

    switch (matchEvent.detailCode) {
      case "point.attack":
        actor.points += 1;
        actor.attackPoints += 1;
        actorTeam.attackPoints += 1;
        break;
      case "point.block":
        actor.points += 1;
        actor.blockPoints += 1;
        actorTeam.blockPoints += 1;
        break;
      case "point.serve-ace":
        actor.points += 1;
        actor.serviceAces += 1;
        actorTeam.serviceAces += 1;
        break;
      case "point.defense":
        actor.points += 1;
        actor.defensePoints += 1;
        actorTeam.defensePoints += 1;
        break;
      default:
        break;
    }''',
    '''    if (matchEvent.type !== "point" || !matchEvent.winnerSchoolId) {
      continue;
    }

    const scoringTeam = teamForSchool(matchEvent.winnerSchoolId);
    scoringTeam.totalPoints += 1;

    switch (matchEvent.detailCode) {
      case "point.attack":
        scoringTeam.attackPoints += 1;
        if (actor) {
          actor.points += 1;
          actor.attackPoints += 1;
        }
        break;
      case "point.block":
        scoringTeam.blockPoints += 1;
        if (actor) {
          actor.points += 1;
          actor.blockPoints += 1;
        }
        break;
      case "point.serve-ace":
        scoringTeam.serviceAces += 1;
        if (actor) {
          actor.points += 1;
          actor.serviceAces += 1;
        }
        break;
      case "point.defense":
        scoringTeam.rallyPoints += 1;
        if (actor) {
          actor.defensePoints += 1;
        }
        break;
      case "point.serve-error":
        scoringTeam.opponentErrorPoints += 1;
        break;
      default:
        break;
    }''',
    "point aggregation",
)
replace_once(
    presentation,
    '''      (player) =>
        player.points * 6 +
        player.blockPoints * 2 +
        player.serviceAces * 2 +
        player.defensePoints +
        player.perfectReceives * 0.75 +
        player.attackSuccessRate * 0.03 +
        player.perfectReceiveRate * 0.02,''',
    '''      (player) =>
        player.points * 8 +
        player.blockPoints * 2 +
        player.serviceAces * 2 +
        player.defensePoints * 1.5 +
        player.perfectReceives * 0.5 +
        player.attackSuccessRate * 0.02,''',
    "MVP score",
)

panels = Path("src/features/match/MatchStatPanels.tsx")
replace_once(
    panels,
    '''  const rows = [
    ["アタック得点", user.attackPoints, opponent.attackPoints],
    ["ブロック得点", user.blockPoints, opponent.blockPoints],
    ["サーブエース", user.serviceAces, opponent.serviceAces],
    [
      "スパイク決定率",
      `${user.attackSuccessRate}%`,
      `${opponent.attackSuccessRate}%`,
    ],
    [
      "Aパス率",
      `${user.perfectReceiveRate}%`,
      `${opponent.perfectReceiveRate}%`,
    ],
    ["ミス数", user.serveErrors, opponent.serveErrors],
  ] as const;''',
    '''  const rows = [
    ["総得点", user.totalPoints, opponent.totalPoints],
    ["アタック得点", user.attackPoints, opponent.attackPoints],
    ["ブロック得点", user.blockPoints, opponent.blockPoints],
    ["サーブエース", user.serviceAces, opponent.serviceAces],
    ["ラリー得点", user.rallyPoints, opponent.rallyPoints],
    ["相手ミス得点", user.opponentErrorPoints, opponent.opponentErrorPoints],
    [
      "アタック決定率",
      `${user.attackSuccessRate}%`,
      `${opponent.attackSuccessRate}%`,
    ],
    ["サーブミス", user.serveErrors, opponent.serveErrors],
  ] as const;''',
    "box score rows",
)
replace_once(
    panels,
    '''          <p>
            {summary.mvp.points}得点 / ブロック{summary.mvp.blockPoints} /
            サーブエース
            {summary.mvp.serviceAces}。攻守で最も勝敗に影響した選手です。
          </p>''',
    '''          <p>
            {summary.mvp.points}得点（アタック{summary.mvp.attackPoints} / ブロック
            {summary.mvp.blockPoints} / エース{summary.mvp.serviceAces}）
            {summary.mvp.defensePoints > 0
              ? `。守備でも${summary.mvp.defensePoints}回、得点につながるプレー。`
              : "。直接得点で勝利に大きく貢献。"}
          </p>''',
    "MVP description",
)
replace_once(
    panels,
    '''          <span>
            <small>決定率</small>
            <strong>{summary.mvp.attackSuccessRate}%</strong>
          </span>
          <span>
            <small>Aパス率</small>
            <strong>{summary.mvp.perfectReceiveRate}%</strong>
          </span>''',
    '''          <span>
            <small>ブロック</small>
            <strong>{summary.mvp.blockPoints}</strong>
          </span>
          <span>
            <small>サーブエース</small>
            <strong>{summary.mvp.serviceAces}</strong>
          </span>''',
    "MVP metrics",
)
replace_once(
    panels,
    '''          <b>Aパス {summary.bestReceiver.perfectReceiveRate}%</b>''',
    '''          <b>
            好レシーブ {summary.bestReceiver.perfectReceives}/
            {summary.bestReceiver.receiveAttempts}
          </b>''',
    "receiver award",
)
replace_once(
    panels,
    '''  serve: "サーブレシーブを安定させ、Aパスから先手を取る。",''',
    '''  serve: "サーブレシーブを安定させ、良い返球から先手を取る。",''',
    "A-pass tactic copy",
)

screen = Path("src/features/match/MatchScreen.tsx")
text = screen.read_text()
start = text.index('          <section className="match-analysis" aria-labelledby="factor-heading">')
end_marker = '          <section\n            className="match-result-actions match-result-actions--fixed"'
end = text.index(end_marker, start)
text = text[:start] + text[end:]
screen.write_text(text)

flow = Path("tests/unit/features/match/MatchFlow.test.tsx")
text = flow.read_text()
text = text.replace(
    '''    expect(\n      within(teamStats).getByText("アタック決定率"),\n    ).toBeInTheDocument();''',
    '''    expect(within(teamStats).getByText("アタック決定率")).toBeInTheDocument();''',
)
flow.write_text(text)
