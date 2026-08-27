import { useMemo, useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../../domain/selectors/playerPresentation";
import { StatBar } from "../../ui/theme/StatBar";
import { TeamScreen } from "./TeamScreen";
import "./player-hub.css";

interface PlayerHubScreenProps {
  state: GameState;
  selection: TeamSelection;
  onChange: (selection: TeamSelection) => void;
}

type HubMode = "roster" | "lineup";

const abilityLabels = {
  attack: "攻撃",
  defense: "守備",
  jump: "跳躍",
  stamina: "スタミナ",
  mental: "メンタル",
} as const;

function playerName(player: Player): string {
  return `${player.lastName} ${player.firstName}`;
}

function playerInitials(player: Player): string {
  return `${player.lastName.slice(0, 1)}${player.firstName.slice(0, 1)}`;
}

export function PlayerHubScreen({
  state,
  selection,
  onChange,
}: PlayerHubScreenProps) {
  const [mode, setMode] = useState<HubMode>("roster");
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(
    null,
  );
  const school = state.schools[state.userSchoolId]!;
  const players = useMemo(
    () =>
      school.playerIds
        .map((playerId) => state.players[playerId])
        .filter((player): player is Player => Boolean(player)),
    [school.playerIds, state.players],
  );
  const selectedPlayer = selectedPlayerId
    ? (state.players[selectedPlayerId] ?? null)
    : null;

  if (mode === "lineup") {
    return (
      <div className="player-hub">
        <nav className="player-hub__tabs" aria-label="選手画面の表示切替">
          <button onClick={() => setMode("roster")} type="button">
            選手一覧
          </button>
          <button aria-current="page" type="button">
            編成
          </button>
        </nav>
        <TeamScreen onChange={onChange} selection={selection} state={state} />
      </div>
    );
  }

  if (selectedPlayer) {
    const abilities = summarizePlayerAbilities(selectedPlayer);
    return (
      <main className="app-content player-hub player-detail">
        <button
          className="player-detail__back"
          onClick={() => setSelectedPlayerId(null)}
          type="button"
        >
          選手一覧へ戻る
        </button>
        <section className="player-detail__hero">
          <div className="player-detail__identity-mark" aria-hidden="true">
            {playerInitials(selectedPlayer)}
          </div>
          <div className="player-detail__identity">
            <span>
              {selectedPlayer.grade}年・{selectedPlayer.preferredPosition}・
              {selectedPlayer.heightCm}cm
            </span>
            <h2>{playerName(selectedPlayer)}</h2>
            <p>{selectedPlayer.reading}</p>
            <div className="player-detail__power">
              <span>総合力</span>
              <strong>
                {Math.round(calculatePlayerDisplayPower(selectedPlayer) / 100)}
              </strong>
            </div>
          </div>
        </section>
        <section className="player-detail__stats" aria-label="選手能力">
          {Object.entries(abilities).map(([key, value]) => (
            <StatBar
              key={key}
              label={abilityLabels[key as keyof typeof abilityLabels]}
              tone="accent"
              value={value}
            />
          ))}
        </section>
        <section className="player-detail__condition" aria-label="選手状態">
          <article>
            <span>状態</span>
            <strong>{selectedPlayer.condition}</strong>
          </article>
          <article>
            <span>疲労</span>
            <strong>{selectedPlayer.fatigue}</strong>
          </article>
          <article>
            <span>士気</span>
            <strong>{selectedPlayer.morale}</strong>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="app-content player-hub">
      <nav className="player-hub__tabs" aria-label="選手画面の表示切替">
        <button aria-current="page" type="button">
          選手一覧
        </button>
        <button onClick={() => setMode("lineup")} type="button">
          編成
        </button>
      </nav>
      <section className="player-hub__heading">
        <div>
          <p className="section-kicker">PLAYER ROSTER</p>
          <h2>選手一覧</h2>
        </div>
        <span>{players.length}人</span>
      </section>
      <div className="player-roster" role="list">
        <div aria-hidden="true" className="player-roster__header">
          <span>No.</span>
          <span>選手</span>
          <span>学年</span>
          <span>Pos</span>
          <span>身長</span>
          <span>総合</span>
          <span>状態</span>
        </div>
        {players.map((player, index) => (
          <button
            aria-label={`選手詳細 ${playerName(player)}`}
            className="player-roster__row"
            data-testid="roster-player-row"
            key={player.id}
            onClick={() => setSelectedPlayerId(player.id)}
            role="listitem"
            type="button"
          >
            <span className="player-roster__number">{index + 1}</span>
            <span className="player-roster__name">
              <strong>{playerName(player)}</strong>
              <small>{player.reading}</small>
            </span>
            <span data-label="学年">{player.grade}年</span>
            <span data-label="Pos">{player.preferredPosition}</span>
            <span data-label="身長">{player.heightCm}cm</span>
            <span className="player-roster__overall" data-label="総合">
              {Math.round(calculatePlayerDisplayPower(player) / 100)}
            </span>
            <span data-label="状態">{player.condition}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
