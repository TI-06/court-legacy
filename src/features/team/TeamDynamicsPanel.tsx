import { useMemo, useState } from "react";
import {
  calculateLeadershipSuitability,
  calculateRelationshipSignal,
} from "../../domain/dynamics/calculateTeamDynamics";
import type {
  CohesionTrend,
  PlayerConcernCode,
  PlayerRole,
} from "../../domain/dynamics/teamDynamicsTypes";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import "./team-dynamics.css";

interface TeamDynamicsPanelProps {
  state: GameState;
  pending: boolean;
  onAssignLeadership: (
    captainPlayerId: PlayerId,
    viceCaptainPlayerId: PlayerId,
  ) => void | Promise<void>;
}

interface LeadershipCandidate {
  player: Player;
  suitability: number;
}

interface LeadershipEditorProps {
  candidates: readonly LeadershipCandidate[];
  captainPlayerId: PlayerId | null;
  viceCaptainPlayerId: PlayerId | null;
  pending: boolean;
  onAssignLeadership: TeamDynamicsPanelProps["onAssignLeadership"];
}

const trendLabels: Record<CohesionTrend, string> = {
  rising: "上向き",
  stable: "横ばい",
  falling: "低下",
};

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

function playerName(player: Player | undefined): string {
  return player ? `${player.lastName} ${player.firstName}` : "未設定";
}

function relationshipLabel(value: number): string {
  if (value >= 70) return "良好";
  if (value <= 35) return "要注意";
  return "安定";
}

function LeadershipEditor({
  candidates,
  captainPlayerId: authoritativeCaptainPlayerId,
  viceCaptainPlayerId: authoritativeViceCaptainPlayerId,
  pending,
  onAssignLeadership,
}: LeadershipEditorProps) {
  const [captainPlayerId, setCaptainPlayerId] = useState<string>(
    authoritativeCaptainPlayerId ?? "",
  );
  const [viceCaptainPlayerId, setViceCaptainPlayerId] = useState<string>(
    authoritativeViceCaptainPlayerId ?? "",
  );
  const canSave =
    !pending &&
    captainPlayerId.length > 0 &&
    viceCaptainPlayerId.length > 0 &&
    captainPlayerId !== viceCaptainPlayerId;

  const saveLeadership = () => {
    if (!canSave) return;
    void onAssignLeadership(
      captainPlayerId as PlayerId,
      viceCaptainPlayerId as PlayerId,
    );
  };

  return (
    <section
      className="team-dynamics__leadership"
      aria-labelledby="leadership-heading"
    >
      <div className="team-dynamics__section-heading">
        <div>
          <p className="section-kicker">役職</p>
          <h3 id="leadership-heading">役職を決める</h3>
        </div>
        <span>保存はサーバーで確定</span>
      </div>
      <div className="team-dynamics__selectors">
        <label>
          <span>主将</span>
          <select
            aria-label="主将"
            disabled={pending}
            onChange={(event) => setCaptainPlayerId(event.target.value)}
            value={captainPlayerId}
          >
            <option value="">選択してください</option>
            {candidates.map(({ player, suitability }) => (
              <option key={player.id} value={player.id}>
                {playerName(player)}・{player.grade}年・適性{suitability}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>副主将</span>
          <select
            aria-label="副主将"
            disabled={pending}
            onChange={(event) => setViceCaptainPlayerId(event.target.value)}
            value={viceCaptainPlayerId}
          >
            <option value="">選択してください</option>
            {candidates.map(({ player, suitability }) => (
              <option key={player.id} value={player.id}>
                {playerName(player)}・{player.grade}年・適性{suitability}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="team-dynamics__save"
        disabled={!canSave}
        onClick={saveLeadership}
        type="button"
      >
        {pending ? "役職を保存しています…" : "役職を保存"}
      </button>
      {captainPlayerId && captainPlayerId === viceCaptainPlayerId ? (
        <p className="team-dynamics__warning">
          主将と副主将は別の選手を選んでください。
        </p>
      ) : null}
    </section>
  );
}

export function TeamDynamicsPanel({
  state,
  pending,
  onAssignLeadership,
}: TeamDynamicsPanelProps) {
  const school = state.schools[state.userSchoolId]!;
  const dynamics = state.teamDynamics;
  const captain = dynamics.captainPlayerId
    ? state.players[dynamics.captainPlayerId]
    : undefined;
  const viceCaptain = dynamics.viceCaptainPlayerId
    ? state.players[dynamics.viceCaptainPlayerId]
    : undefined;
  const players = useMemo(
    () =>
      school.playerIds
        .map((playerId) => state.players[playerId])
        .filter((player): player is Player => Boolean(player)),
    [school.playerIds, state.players],
  );
  const candidates = useMemo(
    () =>
      players
        .map((player) => ({
          player,
          suitability: calculateLeadershipSuitability(player),
        }))
        .sort(
          (left, right) =>
            right.suitability - left.suitability ||
            left.player.id.localeCompare(right.player.id),
        ),
    [players],
  );
  const relationshipSignal = calculateRelationshipSignal(
    state,
    school.playerIds,
  );
  const concerns = players.flatMap((player) =>
    (dynamics.playerConcerns[player.id] ?? []).map((concern) => ({
      player,
      concern,
    })),
  );
  const leadershipEditorKey = `${dynamics.captainPlayerId ?? "none"}:${dynamics.viceCaptainPlayerId ?? "none"}`;

  return (
    <section className="team-dynamics" aria-labelledby="team-dynamics-heading">
      <div className="team-dynamics__heading">
        <div>
          <p className="section-kicker">チーム管理</p>
          <h2 id="team-dynamics-heading">チーム状態</h2>
          <p>役職・信頼・起用状況から、チームのまとまりを確認できます。</p>
        </div>
        <div className="team-dynamics__cohesion" aria-label="チーム結束力">
          <span>結束力</span>
          <strong>{dynamics.cohesion}</strong>
          <small>{trendLabels[dynamics.cohesionTrend]}</small>
        </div>
      </div>

      <div className="team-dynamics__metrics" aria-label="チーム状態指標">
        <article>
          <span>主将</span>
          <strong>{playerName(captain)}</strong>
        </article>
        <article>
          <span>副主将</span>
          <strong>{playerName(viceCaptain)}</strong>
        </article>
        <article>
          <span>関係性</span>
          <strong>関係性 {relationshipLabel(relationshipSignal)}</strong>
          <small>{relationshipSignal}/100</small>
        </article>
        <article>
          <span>気になる状態</span>
          <strong>{concerns.length}件</strong>
          <small>直近の起用・状態から判定</small>
        </article>
      </div>

      <LeadershipEditor
        key={leadershipEditorKey}
        candidates={candidates}
        captainPlayerId={dynamics.captainPlayerId}
        viceCaptainPlayerId={dynamics.viceCaptainPlayerId}
        pending={pending}
        onAssignLeadership={onAssignLeadership}
      />

      <div className="team-dynamics__detail-grid">
        <section aria-labelledby="suitability-heading">
          <div className="team-dynamics__section-heading">
            <div>
              <p className="section-kicker">候補比較</p>
              <h3 id="suitability-heading">主将適性</h3>
            </div>
          </div>
          <div className="team-dynamics__candidate-list">
            {candidates.slice(0, 6).map(({ player, suitability }, index) => (
              <article key={player.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{playerName(player)}</strong>
                  <small>
                    {player.grade}年・{player.preferredPosition}・
                    {roleLabels[dynamics.playerRoles[player.id] ?? "reserve"]}
                  </small>
                </div>
                <b>{suitability}</b>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="concern-heading">
          <div className="team-dynamics__section-heading">
            <div>
              <p className="section-kicker">選手の注意点</p>
              <h3 id="concern-heading">気になる選手</h3>
            </div>
          </div>
          {concerns.length > 0 ? (
            <div className="team-dynamics__concern-list">
              {concerns.map(({ player, concern }, index) => (
                <article key={`${player.id}:${concern.code}:${index}`}>
                  <div>
                    <strong>
                      {playerName(player)}・{concernLabels[concern.code]}
                    </strong>
                    <small>
                      重要度 {concern.severity}/3・信頼 {player.trust}・士気{" "}
                      {player.morale}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="team-dynamics__empty">
              現在、強い不満や起用上の注意はありません。
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
