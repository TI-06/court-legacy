import { useMemo, useState } from "react";
import { isWeeklyActionCompleted } from "../../domain/calendar/weekProgression";
import type {
  PlayerConcernCode,
  PlayerRole,
} from "../../domain/dynamics/teamDynamicsTypes";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { PlayerId } from "../../domain/model/identifiers";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../../domain/selectors/playerPresentation";
import { individualTrainingInstructions } from "../../data/individualTrainingInstructions";
import { BottomSheet } from "../../ui/BottomSheet";
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
  trainingPending?: boolean;
  onChangeTraining?: (
    playerId: PlayerId,
    instructionId: string,
  ) => void | Promise<void>;
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
const playerName = (p: Player) => `${p.lastName} ${p.firstName}`;
const playerOverall = (p: Player) =>
  Math.round(calculatePlayerDisplayPower(p) / 100);
function HubTabs({
  mode,
  onChange,
}: {
  mode: HubMode;
  onChange: (m: HubMode) => void;
}) {
  return (
    <nav className="player-hub__tabs" aria-label="選手画面の表示切替">
      {(
        [
          ["roster", "選手一覧"],
          ["lineup", "編成"],
          ["dynamics", "チーム状態"],
        ] as const
      ).map(([id, label]) => (
        <button
          aria-current={mode === id ? "page" : undefined}
          key={id}
          onClick={() => onChange(id)}
          type="button"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
export function PlayerHubScreen({
  state,
  selection,
  onChange,
  onAssignLeadership,
  leadershipPending = false,
  trainingPending = false,
  onChangeTraining,
}: PlayerHubScreenProps) {
  const [mode, setMode] = useState<HubMode>("roster");
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(
    null,
  );
  const [trainingPlayerId, setTrainingPlayerId] = useState<PlayerId | null>(
    null,
  );
  const school = state.schools[state.userSchoolId]!;
  const players = useMemo(
    () =>
      school.playerIds
        .map((id) => state.players[id])
        .filter((p): p is Player => Boolean(p)),
    [school.playerIds, state.players],
  );
  const selectedPlayer = selectedPlayerId
    ? (state.players[selectedPlayerId] ?? null)
    : null;
  const trainingPlayer = trainingPlayerId
    ? (state.players[trainingPlayerId] ?? null)
    : null;
  const trainingDone = isWeeklyActionCompleted(state, "training");
  const assignmentName = (id: PlayerId) => {
    const assignment =
      state.weeklySchedule.trainingPlan.individualAssignments.find(
        (a) => a.playerId === id,
      );
    return (
      individualTrainingInstructions.find(
        (i) => i.id === (assignment?.instructionId ?? "instruction.overall"),
      )?.name ?? "全体"
    );
  };
  if (mode === "lineup")
    return (
      <div className="player-hub">
        <HubTabs mode={mode} onChange={setMode} />
        <TeamScreen onChange={onChange} selection={selection} state={state} />
      </div>
    );
  if (mode === "dynamics")
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
  if (selectedPlayer) {
    const abilities = summarizePlayerAbilities(selectedPlayer),
      role = state.teamDynamics.playerRoles[selectedPlayer.id] ?? "reserve",
      concerns = state.teamDynamics.playerConcerns[selectedPlayer.id] ?? [],
      condition = getPlayerConditionPresentation(selectedPlayer.condition);
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
          <article
            className={`player-condition player-condition--${condition.colorToken}`}
          >
            <span>調子</span>
            <strong>
              {condition.icon} {condition.label}
            </strong>
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
        {concerns.length ? (
          <section
            className="player-detail__concerns"
            aria-label="選手の気になる状態"
          >
            <h3>気になる状態</h3>
            <ul>
              {concerns.map((c, i) => (
                <li key={`${c.code}:${i}`}>
                  {concernLabels[c.code]}・重要度 {c.severity}/3
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
        {players.map((player, index) => {
          const condition = getPlayerConditionPresentation(player.condition),
            training = assignmentName(player.id);
          return (
            <article
              className="player-roster__row"
              data-testid="roster-player-row"
              key={player.id}
            >
              <button
                aria-label={`選手詳細 ${playerName(player)}`}
                className="player-roster__main"
                onClick={() => setSelectedPlayerId(player.id)}
                type="button"
              >
                <span className="player-roster__number">{index + 1}</span>
                <span className="player-roster__name">
                  <strong>{playerName(player)}</strong>
                  <small>
                    {player.grade}年・{player.preferredPosition}・
                    {player.heightCm}cm
                  </small>
                </span>
                <span
                  className={`player-roster__condition player-condition--${condition.colorToken}`}
                  title={condition.label}
                >
                  <b aria-hidden="true">{condition.icon}</b>
                  <small>{condition.label}</small>
                </span>
                <span className="player-roster__overall">
                  <small>総合</small>
                  <strong>{playerOverall(player)}</strong>
                </span>
              </button>
              <button
                aria-label={`${playerName(player)} 練習 ${training}`}
                className="player-training-chip"
                disabled={trainingPending || trainingDone}
                onClick={() => setTrainingPlayerId(player.id)}
                type="button"
              >
                {training}
              </button>
            </article>
          );
        })}
      </div>
      <BottomSheet
        open={Boolean(trainingPlayer)}
        onClose={() => setTrainingPlayerId(null)}
        title={
          trainingPlayer
            ? `${playerName(trainingPlayer)}の個人練習`
            : "個人練習"
        }
        description="今週の練習を選択"
      >
        <div className="player-training-options">
          {individualTrainingInstructions.map((item) => (
            <button
              key={item.id}
              disabled={trainingPending || trainingDone}
              onClick={() => {
                if (trainingPlayer)
                  void onChangeTraining?.(trainingPlayer.id, item.id);
                setTrainingPlayerId(null);
              }}
              type="button"
            >
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      </BottomSheet>
    </main>
  );
}
