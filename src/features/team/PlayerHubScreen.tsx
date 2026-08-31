import { useMemo, useState } from "react";
import type {
  PlayerConcernCode,
  PlayerRole,
} from "../../domain/dynamics/teamDynamicsTypes";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { PlayerId } from "../../domain/model/identifiers";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../../domain/selectors/playerPresentation";
import { StatBar } from "../../ui/theme/StatBar";
import { TeamDynamicsPanel } from "./TeamDynamicsPanel";
import { TeamScreen } from "./TeamScreen";
import "./player-hub.css";

interface PlayerHubScreenProps {
  state: GameState;
  selection: TeamSelection;
  onChange: (selection: TeamSelection) => void;
  onAssignLeadership: (
    captainPlayerId: PlayerId,
    viceCaptainPlayerId: PlayerId,
  ) => void | Promise<void>;
  leadershipPending?: boolean;
}

type HubMode = "roster" | "lineup" | "dynamics";

const abilityLabels = {
  attack: "攻撃",
  defense: "守備",
  jump: "跳躍",
  stamina: "スタミナ",
  mental: "メンタル",
} as const;

const roleLabels: Record<PlayerRole, string> = {
  ace: "エース",
  starter: "先発",
  rotation: "ローテーション",
  development: "育成枠",
  reserve: "控え",
};

const concernLabels: Record<PlayerConcernCode, string> = {
  "playing-time": "出場機会",
  "role-mismatch": "役割への不満",
  "injury-overuse": "怪我・起用負荷",
  "team-slump": "チーム不調",
};

function playerName(player: Player): string {
  return `${player.lastName} ${player.firstName}`;
}

function playerOverall(player: Player): number {
  return Math.round(calculatePlayerDisplayPower(player) / 100);
}

function HubTabs({
  mode,
  onChange,
}: {
  mode: HubMode;
  onChange: (mode: HubMode) => void;
}) {
  return (
    <nav className="player-hub__tabs" aria-label="選手画面の表示切替">
      <button
        aria-current={mode === "roster" ? "page" : undefined}
        onClick={() => onChange("roster")}
        type="button"
      >
        選手一覧
      </button>
      <button
        aria-current={mode === "lineup" ? "page" : undefined}
        onClick={() => onChange("lineup")}
        type="button"
      >
        編成
      </button>
      <button
        aria-current={mode === "dynamics" ? "page" : undefined}
        onClick={() => onChange("dynamics")}
        type="button"
      >
        チーム状態
      </button>
    </nav>
  );
}

export function PlayerHubScreen({
  state,
  selection,
  onChange,
  onAssignLeadership,
  leadershipPending = false,
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
        <HubTabs mode={mode} onChange={setMode} />
        <TeamScreen onChange={onChange} selection={selection} state={state} />
      </div>
    );
  }

  if (mode === "dynamics") {
    return (
      <main className="app-content player-hub">
        <HubTabs mode={mode} onChange={setMode} />
        <TeamDynamicsPanel
          onAssignLeadership={onAssignLeadership}
          pending={leadershipPending}
          state={state}
        />
      </main>
    );
  }

  if (selectedPlayer) {
    const abilities = summarizePlayerAbilities(selectedPlayer);
    const role = state.teamDynamics.playerRoles[selectedPlayer.id] ?? "reserve";
    const concerns = state.teamDynamics.playerConcerns[selectedPlayer.id] ?? [];
    return (
      <main className="app-content player-hub player-detail">
        <button
          aria-label="選手一覧へ戻る"
          className="player-detail__back"
          onClick={() => setSelectedPlayerId(null)}
          type="button"
        >
          ‹ 選手一覧
        </button>

        <section className="player-detail__summary">
          <div className="player-detail__identity">
            <h2>{playerName(selectedPlayer)}</h2>
            <span>
              {selectedPlayer.grade}年・{selectedPlayer.preferredPosition}・
              {selectedPlayer.heightCm}cm
            </span>
          </div>
          <div className="player-detail__power">
            <span>総合力</span>
            <strong>{playerOverall(selectedPlayer)}</strong>
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

        <section className="player-detail__metrics" aria-label="選手状態">
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
          <article>
            <span>役割</span>
            <strong>{roleLabels[role]}</strong>
          </article>
          <article>
            <span>信頼</span>
            <strong>{selectedPlayer.trust}</strong>
          </article>
        </section>

        {concerns.length > 0 ? (
          <section
            className="player-detail__concerns"
            aria-label="選手の気になる状態"
          >
            <h3>気になる状態</h3>
            <ul>
              {concerns.map((concern, index) => (
                <li key={`${concern.code}:${index}`}>
                  {concernLabels[concern.code]}・重要度 {concern.severity}/3
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    );
  }

  return (
    <main className="app-content player-hub">
      <HubTabs mode={mode} onChange={setMode} />
      <section className="player-hub__heading">
        <div>
          <p className="section-kicker">登録選手</p>
          <h2>選手一覧</h2>
        </div>
        <span>{players.length}人</span>
      </section>
      <div className="player-roster">
        {players.map((player, index) => (
          <button
            aria-label={`選手詳細 ${playerName(player)}`}
            className="player-roster__row"
            data-testid="roster-player-row"
            key={player.id}
            onClick={() => setSelectedPlayerId(player.id)}
            type="button"
          >
            <span className="player-roster__number">{index + 1}</span>
            <span className="player-roster__name">
              <strong>{playerName(player)}</strong>
              <small>
                {player.grade}年・{player.preferredPosition}・{player.heightCm}cm
              </small>
            </span>
            <span className="player-roster__status">
              <small>状態</small>
              <strong>{player.condition}</strong>
            </span>
            <span className="player-roster__overall">
              <small>総合</small>
              <strong>{playerOverall(player)}</strong>
            </span>
            <span className="player-roster__chevron" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
