import { useMemo, useState } from "react";
import {
  calculateCohesionBreakdown,
  calculateLeadershipSuitability,
} from "../../domain/dynamics/calculateTeamDynamics";
import { selectPlayerConcernGuidance } from "../../domain/dynamics/playerConcernGuidance";
import type {
  CohesionTrend,
  PlayerRole,
} from "../../domain/dynamics/teamDynamicsTypes";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import { MobileChoiceSheet } from "../../ui/MobileChoiceSheet";
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
        <MobileChoiceSheet
          ariaLabel="主将"
          disabled={pending}
          label="主将"
          onChange={setCaptainPlayerId}
          options={[
            { value: "", label: "未設定" },
            ...candidates.map(({ player, suitability }) => ({
              value: player.id,
              label: playerName(player),
              description: `${player.grade}年・${player.preferredPosition}`,
              meta: `適性 ${suitability}`,
            })),
          ]}
          title="主将を選ぶ"
          value={captainPlayerId}
        />
        <MobileChoiceSheet
          ariaLabel="副主将"
          disabled={pending}
          label="副主将"
          onChange={setViceCaptainPlayerId}
          options={[
            { value: "", label: "未設定" },
            ...candidates.map(({ player, suitability }) => ({
              value: player.id,
              label: playerName(player),
              description: `${player.grade}年・${player.preferredPosition}`,
              meta: `適性 ${suitability}`,
            })),
          ]}
          title="副主将を選ぶ"
          value={viceCaptainPlayerId}
        />
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
  const cohesionBreakdown = calculateCohesionBreakdown(state, dynamics);
  const relationshipSignal = cohesionBreakdown.relationships;
  const cohesionMatchEffect =
    ((cohesionBreakdown.cohesion - 50) / 50) * 2;
  const cohesionMatchEffectLabel = `${cohesionMatchEffect >= 0 ? "+" : ""}${cohesionMatchEffect.toFixed(1)}%`;
  const cohesionFactors = [
    { label: "士気", value: cohesionBreakdown.morale, weight: "25%" },
    { label: "信頼", value: cohesionBreakdown.trust, weight: "20%" },
    { label: "関係性", value: cohesionBreakdown.relationships, weight: "20%" },
    { label: "主将", value: cohesionBreakdown.captain, weight: "15%" },
    { label: "副主将", value: cohesionBreakdown.viceCaptain, weight: "5%" },
    { label: "チーム適応", value: cohesionBreakdown.adaptation, weight: "10%" },
    {
      label: "スタメン継続",
      value: cohesionBreakdown.lineupContinuity,
      weight: "5%",
    },
  ];
  const concerns = players.flatMap((player) =>
    selectPlayerConcernGuidance(state, player.id).map((guidance) => ({
      player,
      guidance,
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

      <section
        aria-labelledby="cohesion-guide-heading"
        className="team-dynamics__cohesion-guide"
      >
        <div className="team-dynamics__section-heading">
          <div>
            <p className="section-kicker">結束のしくみ</p>
            <h3 id="cohesion-guide-heading">結束の内訳</h3>
          </div>
          <span>高いほどチームが安定</span>
        </div>
        <div
          aria-label="結束の内訳"
          className="team-dynamics__cohesion-factors"
        >
          {cohesionFactors.map((factor) => (
            <article key={factor.label}>
              <span>{factor.label}</span>
              <strong>{factor.value}</strong>
              <small>影響 {factor.weight}</small>
            </article>
          ))}
        </div>
        <div className="team-dynamics__cohesion-effect">
          <div>
            <span>現在の試合効果</span>
            <strong>連携補正 {cohesionMatchEffectLabel}</strong>
          </div>
          <small>
            PvE試合の準備度に反映。結束だけの効果は最大 -2.0%〜+2.0%です。
          </small>
        </div>
        <div className="team-dynamics__cohesion-tips">
          <strong>結束を上げるには</strong>
          <p>
            「連携練習」やコンビ・ローテーション練習で関係性を上げる／
            公式戦で勝って士気を上げる／選手の不満を解消する／
            適性の高い主将・副主将を置く／スタメンをある程度継続する。
          </p>
        </div>
      </section>

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
              {concerns.map(({ player, guidance }, index) => (
                <article key={`${player.id}:${guidance.code}:${index}`}>
                  <div>
                    <strong>
                      {playerName(player)}・{guidance.title}
                    </strong>
                    <small>{guidance.reason}</small>
                    <small>
                      {guidance.progressLabel}・重要度 {guidance.severity}
                      /3・信頼 {player.trust}・士気 {player.morale}
                    </small>
                    <p>対処：{guidance.resolution}</p>
                  </div>
                  <span>
                    {guidance.status === "improving" ? "改善中" : "対応が必要"}
                  </span>
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
