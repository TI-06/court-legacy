import { useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { MatchCommand, MatchState } from "../../domain/model/Match";
import type { Player } from "../../domain/model/Player";
import type { PvpPublicOpponentTarget } from "../../domain/pvp/pvpContracts";
import type { PlayerId } from "../../domain/model/identifiers";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import { opportunityRequestByPlayerId } from "../../domain/dynamics/playerOpportunityRequests";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../../domain/selectors/playerPresentation";
import { ratingToGrade } from "../../domain/selectors/ratingGrades";
import type { MatchTacticPlan } from "../../domain/team/matchTactics";
import {
  attackTacticOptions,
  blockTacticOptions,
  serveTacticOptions,
  type TacticOption,
} from "../team/tacticsPresentation";
import { BottomSheet } from "../../ui/BottomSheet";
import type { LiveMatchInsight } from "./liveMatchIntelligence";

const substitutionCourtOrder = [4, 3, 2, 5, 6, 1] as const;

interface MatchCommandPanelProps {
  state: GameState;
  match: MatchState;
  pending: boolean;
  opponentTargets?: PvpPublicOpponentTarget[];
  benchInsights?: readonly LiveMatchInsight[];
  onCommand: (command: MatchCommand) => void | Promise<void>;
}

function playerName(player: Pick<Player, "firstName" | "lastName">): string {
  return `${player.lastName} ${player.firstName}`;
}

function playerOverallGrade(player: Player): string {
  const overall = Math.round(calculatePlayerDisplayPower(player) / 100);
  return ratingToGrade(overall);
}

function playerAttackGrade(player: Player): string {
  return ratingToGrade(summarizePlayerAbilities(player).attack);
}

function encouragementNeedScore(player: Player): number {
  return (
    Math.max(0, player.fatigue) * 0.45 +
    Math.max(0, 100 - player.condition) * 0.3 +
    Math.max(0, 100 - player.abilities.mental) * 0.25
  );
}

function SubstitutionPlayerButton({
  player,
  pending,
  selected,
  slot,
  priorityLabel,
  onSelect,
}: {
  player: Player;
  pending: boolean;
  selected: boolean;
  slot?: number;
  priorityLabel?: string;
  onSelect: () => void;
}) {
  const condition = getPlayerConditionPresentation(player.condition);

  return (
    <button
      aria-label={playerName(player)}
      aria-pressed={selected}
      className="match-command-substitution__player"
      disabled={pending}
      onClick={onSelect}
      type="button"
    >
      <span className="match-command-substitution__identity">
        <span>
          {slot ? <b>R{slot}</b> : null}
          <small>{slot ? "COURT" : "BENCH"}</small>
        </span>
        <strong>{playerName(player)}</strong>
        <small>{player.preferredPosition}</small>
        {priorityLabel ? (
          <em className="match-command-substitution__request-badge">
            {priorityLabel}
          </em>
        ) : null}
      </span>
      <span
        className={`match-command-substitution__condition player-condition--${condition.colorToken}`}
      >
        <b aria-hidden="true">{condition.icon}</b>
        <small>{condition.label}</small>
      </span>
      <span className="match-command-substitution__grade">
        <small>総合</small>
        <strong>{playerOverallGrade(player)}</strong>
      </span>
    </button>
  );
}

function TacticChoiceGroup<Value extends string>({
  label,
  value,
  options,
  pending,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly TacticOption<Value>[];
  pending: boolean;
  onChange: (value: Value) => void;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <section
      aria-label={label}
      className="match-command-tactics__axis"
      role="group"
    >
      <div className="match-command-tactics__axis-heading">
        <strong>{label}</strong>
        <small>{selected?.description}</small>
      </div>
      <div className="match-command-tactics__choices">
        {options.map((option) => (
          <button
            aria-label={option.label}
            aria-pressed={value === option.value}
            disabled={pending}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function MatchCommandPanel({
  state,
  match,
  pending,
  opponentTargets,
  benchInsights = [],
  onCommand,
}: MatchCommandPanelProps) {
  const runtime = match.runtime;
  const reason = runtime?.pendingDecisionReason;
  const isUserDecision =
    match.phase === "coach-decision" &&
    match.pendingCoachCommandForSchoolId === state.userSchoolId &&
    runtime?.controlledSchoolId === state.userSchoolId &&
    reason !== null &&
    reason !== undefined;

  // Draft changes stay match-local until one complete command is submitted.
  const currentPlan =
    runtime && match.homeSchoolId === state.userSchoolId
      ? runtime.homeTactics
      : runtime?.awayTactics;
  const userSelection =
    match.homeSchoolId === state.userSchoolId
      ? match.homeSelection
      : match.awaySelection;
  const opponentSelection =
    match.homeSchoolId === state.userSchoolId
      ? match.awaySelection
      : match.homeSelection;
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const [draftPlan, setDraftPlan] = useState<MatchTacticPlan | null>(null);
  const [substitutionOpen, setSubstitutionOpen] = useState(false);
  const [playerDirectiveOpen, setPlayerDirectiveOpen] = useState(false);
  const [opponentTargetOpen, setOpponentTargetOpen] = useState(false);
  const [outgoingPlayerId, setOutgoingPlayerId] = useState<PlayerId | null>(
    null,
  );
  const [incomingPlayerId, setIncomingPlayerId] = useState<PlayerId | null>(
    null,
  );

  if (!isUserDecision || !currentPlan) {
    return null;
  }

  const timeoutAvailable =
    reason !== "set-break" &&
    !runtime.timeoutUsedSchoolIds.includes(state.userSchoolId);
  const continueLabel =
    reason === "set-break"
      ? "このまま次セットへ"
      : reason === "critical-score"
        ? "このまま勝負する"
        : "このまま続ける";
  const quickCriticalPlans =
    reason === "critical-score"
      ? [
          {
            label: "サーブで攻める",
            plan: { ...currentPlan, serve: "aggressive" as const },
          },
          {
            label: "速攻で崩す",
            plan: { ...currentPlan, attack: "quick" as const },
          },
          {
            label: "サイドで押す",
            plan: { ...currentPlan, attack: "side" as const },
          },
        ]
      : [];
  const tacticsDraft = draftPlan ?? currentPlan;
  const courtPlayers = substitutionCourtOrder
    .map((slot) =>
      userSelection.rotation.find((assignment) => assignment.slot === slot),
    )
    .filter(
      (assignment): assignment is (typeof userSelection.rotation)[number] =>
        Boolean(assignment),
    )
    .map((assignment) => state.players[assignment.playerId])
    .filter((player): player is Player => Boolean(player));
  const courtSlotByPlayerId = new Map(
    userSelection.rotation.map(
      (assignment) => [assignment.playerId, assignment.slot] as const,
    ),
  );
  const opportunityRequests = opportunityRequestByPlayerId(state);
  const benchPlayers = userSelection.benchPlayerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player))
    .sort((left, right) => {
      const leftRequest = opportunityRequests[left.id];
      const rightRequest = opportunityRequests[right.id];
      const leftPriority = leftRequest
        ? leftRequest.kind === "promise"
          ? 100 + leftRequest.severity
          : leftRequest.severity
        : 0;
      const rightPriority = rightRequest
        ? rightRequest.kind === "promise"
          ? 100 + rightRequest.severity
          : rightRequest.severity
        : 0;
      return rightPriority - leftPriority;
    });
  const liberoPlayer = userSelection.liberoPlayerId
    ? (state.players[userSelection.liberoPlayerId] ?? null)
    : null;
  const directivePlayers =
    liberoPlayer &&
    !courtPlayers.some((player) => player.id === liberoPlayer.id)
      ? [...courtPlayers, liberoPlayer]
      : courtPlayers;
  const publicOpponentTargets =
    opponentTargets?.map((target) => ({
      id: target.playerId,
      firstName: target.firstName,
      lastName: target.lastName,
      preferredPosition: target.preferredPosition,
      isLibero: target.role === "libero",
    })) ?? null;
  const localOpponentCourtPlayers = opponentSelection.rotation
    .map((assignment) => state.players[assignment.playerId])
    .filter((player): player is Player => Boolean(player))
    .map((player) => ({ ...player, isLibero: false }));
  const localOpponentLiberoPlayer = opponentSelection.liberoPlayerId
    ? (state.players[opponentSelection.liberoPlayerId] ?? null)
    : null;
  const localServeTargets =
    localOpponentLiberoPlayer &&
    !localOpponentCourtPlayers.some(
      (player) => player.id === localOpponentLiberoPlayer.id,
    )
      ? [
          ...localOpponentCourtPlayers,
          { ...localOpponentLiberoPlayer, isLibero: true },
        ]
      : localOpponentCourtPlayers;
  const serveTargetPlayers = publicOpponentTargets ?? localServeTargets;
  const blockTargetPlayers = serveTargetPlayers.filter(
    (player) =>
      !player.isLibero && ["OH", "MB", "OP"].includes(player.preferredPosition),
  );

  const rotationPlayerIds = new Set(
    userSelection.rotation.map((assignment) => assignment.playerId),
  );
  const outgoingPlayer = outgoingPlayerId
    ? (state.players[outgoingPlayerId] ?? null)
    : null;
  const incomingPlayer = incomingPlayerId
    ? (state.players[incomingPlayerId] ?? null)
    : null;
  const liveAttackInsight =
    benchInsights.find(
      (insight) =>
        insight.suggestedCommand === "focus-attacker" &&
        insight.targetPlayerId !== null &&
        rotationPlayerIds.has(insight.targetPlayerId) &&
        state.players[insight.targetPlayerId]?.preferredPosition !== "L",
    ) ?? null;
  const liveAttackRecommendation = liveAttackInsight?.targetPlayerId
    ? (state.players[liveAttackInsight.targetPlayerId] ?? null)
    : null;
  const abilityAttackRecommendation =
    [...courtPlayers]
      .filter((player) => player.preferredPosition !== "L")
      .sort(
        (left, right) =>
          summarizePlayerAbilities(right).attack -
            summarizePlayerAbilities(left).attack ||
          right.condition - left.condition,
      )[0] ?? null;
  const attackRecommendation =
    liveAttackRecommendation ?? abilityAttackRecommendation;
  const liveServeTargetId =
    benchInsights.find(
      (insight) =>
        insight.suggestedCommand === "target-serve-receiver" &&
        insight.targetPlayerId !== null &&
        serveTargetPlayers.some(
          (player) => player.id === insight.targetPlayerId,
        ),
    )?.targetPlayerId ?? null;
  const liveBlockTargetId =
    benchInsights.find(
      (insight) =>
        insight.suggestedCommand === "mark-opponent-attacker" &&
        insight.targetPlayerId !== null &&
        blockTargetPlayers.some(
          (player) => player.id === insight.targetPlayerId,
        ),
    )?.targetPlayerId ?? null;
  const actionableBenchInsights = benchInsights.filter((insight) => {
    switch (insight.suggestedCommand) {
      case "timeout":
        return timeoutAvailable;
      case "focus-attacker":
        return liveAttackInsight?.targetPlayerId === insight.targetPlayerId;
      case "target-serve-receiver":
        return liveServeTargetId === insight.targetPlayerId;
      case "mark-opponent-attacker":
        return liveBlockTargetId === insight.targetPlayerId;
    }
  });
  const encouragementRecommendation =
    [...directivePlayers].sort(
      (left, right) =>
        encouragementNeedScore(right) - encouragementNeedScore(left),
    )[0] ?? null;

  const openTactics = () => {
    setDraftPlan({ ...currentPlan });
    setTacticsOpen(true);
  };

  const updateTactics = <Axis extends keyof MatchTacticPlan>(
    axis: Axis,
    value: MatchTacticPlan[Axis],
  ) => {
    setDraftPlan((current) => ({ ...(current ?? currentPlan), [axis]: value }));
  };

  const tacticPresets: ReadonlyArray<{
    label: string;
    detail: string;
    plan: MatchTacticPlan;
  }> = [
    {
      label: "安定",
      detail: "ミスを抑えて粘る",
      plan: { serve: "safe", attack: "balanced", block: "read" },
    },
    {
      label: "標準",
      detail: "偏りなく戦う",
      plan: { serve: "balanced", attack: "balanced", block: "mixed" },
    },
    {
      label: "攻め",
      detail: "リスクを取って押す",
      plan: { serve: "aggressive", attack: "quick", block: "commit" },
    },
  ];

  const submitTactics = () => {
    void onCommand({ type: "set-match-tactics", plan: { ...tacticsDraft } });
    setTacticsOpen(false);
  };

  const closeSubstitution = () => {
    setSubstitutionOpen(false);
    setOutgoingPlayerId(null);
    setIncomingPlayerId(null);
  };

  const openSubstitution = () => {
    setOutgoingPlayerId(null);
    setIncomingPlayerId(null);
    setSubstitutionOpen(true);
  };

  const selectOutgoingPlayer = (playerId: PlayerId) => {
    setOutgoingPlayerId(playerId);
    setIncomingPlayerId(null);
  };

  const submitSubstitution = () => {
    if (!outgoingPlayerId || !incomingPlayerId) return;
    void onCommand({
      type: "substitute",
      outgoingPlayerId,
      incomingPlayerId,
    });
    closeSubstitution();
  };

  const openBenchInsight = (insight: LiveMatchInsight) => {
    switch (insight.suggestedCommand) {
      case "timeout":
        void onCommand({ type: "timeout" });
        return;
      case "focus-attacker":
        setPlayerDirectiveOpen(true);
        return;
      case "target-serve-receiver":
      case "mark-opponent-attacker":
        setOpponentTargetOpen(true);
        return;
    }
  };

  const benchInsightActionLabel = (insight: LiveMatchInsight): string => {
    switch (insight.suggestedCommand) {
      case "timeout":
        return "タイムアウトを取る";
      case "focus-attacker":
        return "個人指示を見る";
      case "target-serve-receiver":
        return "サーブ候補を見る";
      case "mark-opponent-attacker":
        return "警戒候補を見る";
    }
  };

  return (
    <>
      <section className="match-command-panel" aria-label="監督指示">
        <div className="match-command-panel__heading">
          <span>判断タイミング</span>
          <h2>監督指示</h2>
          <p>
            {reason === "opponent-run"
              ? "相手に4連続ポイントを許しています"
              : reason === "mid-set"
                ? "セット中盤です。ここで流れを作る指示を選べます"
                : reason === "critical-score"
                  ? "終盤の接戦です。次の数点をどう取りにいくか選べます"
                  : "セット間の監督指示"}
          </p>
        </div>

        {actionableBenchInsights.length > 0 ? (
          <section className="match-bench-report" aria-label="ベンチレポート">
            <header>
              <div>
                <span>BENCH REPORT</span>
                <strong>今の試合内容から</strong>
              </div>
              <small>観測済みのプレーのみ</small>
            </header>
            <div className="match-bench-report__list">
              {actionableBenchInsights.map((insight) => (
                <article
                  key={`${insight.kind}-${insight.targetPlayerId ?? "team"}`}
                >
                  <div>
                    <strong>{insight.headline}</strong>
                    <p>{insight.detail}</p>
                  </div>
                  <button
                    disabled={pending}
                    onClick={() => openBenchInsight(insight)}
                    type="button"
                  >
                    {benchInsightActionLabel(insight)}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {quickCriticalPlans.length > 0 ? (
          <div className="match-command-quick" aria-label="重要場面の一手">
            <span>この場面の一手</span>
            <div>
              {quickCriticalPlans.map((item) => (
                <button
                  disabled={pending}
                  key={item.label}
                  onClick={() =>
                    void onCommand({
                      type: "set-match-tactics",
                      plan: { ...item.plan },
                    })
                  }
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="match-command-actions">
          {timeoutAvailable ? (
            <button
              disabled={pending}
              onClick={() => void onCommand({ type: "timeout" })}
              type="button"
            >
              タイムアウト
            </button>
          ) : null}
          <button disabled={pending} onClick={openTactics} type="button">
            戦術変更
          </button>
          <button disabled={pending} onClick={openSubstitution} type="button">
            選手交代
          </button>
          {reason !== "set-break" ? (
            <>
              <button
                disabled={pending}
                onClick={() => setPlayerDirectiveOpen(true)}
                type="button"
              >
                個人指示・声かけ
              </button>
              <button
                disabled={pending}
                onClick={() => setOpponentTargetOpen(true)}
                type="button"
              >
                相手を狙う
              </button>
            </>
          ) : null}
          <button
            className="match-command-actions__continue"
            disabled={pending}
            onClick={() => void onCommand({ type: "continue" })}
            type="button"
          >
            {continueLabel}
          </button>
        </div>
      </section>

      <BottomSheet
        description="5ラリーだけ、攻撃を集める選手か声をかける選手を指定します。"
        onClose={() => setPlayerDirectiveOpen(false)}
        open={playerDirectiveOpen}
        title="選手指示"
      >
        <div className="match-command-player-directive">
          <p>
            攻撃を託す選手、声をかける選手を選びます。
            推奨は試合中の実績を優先し、実績が少ない場合は能力・調子から示します。
          </p>
          <div
            aria-label="おすすめ個人指示"
            className="match-command-player-directive__recommendations"
          >
            {attackRecommendation ? (
              <button
                disabled={pending}
                onClick={() => {
                  setPlayerDirectiveOpen(false);
                  void onCommand({
                    type: "focus-attacker",
                    playerId: attackRecommendation.id,
                  });
                }}
                type="button"
              >
                <span>攻撃を託すなら</span>
                <strong>{playerName(attackRecommendation)}</strong>
                <small>
                  {liveAttackRecommendation?.id === attackRecommendation.id &&
                  liveAttackInsight
                    ? liveAttackInsight.detail
                    : `攻撃${playerAttackGrade(attackRecommendation)}・総合${playerOverallGrade(attackRecommendation)}`}
                </small>
              </button>
            ) : null}
            {encouragementRecommendation ? (
              <button
                disabled={pending}
                onClick={() => {
                  setPlayerDirectiveOpen(false);
                  void onCommand({
                    type: "encourage-player",
                    playerId: encouragementRecommendation.id,
                  });
                }}
                type="button"
              >
                <span>声をかけるなら</span>
                <strong>{playerName(encouragementRecommendation)}</strong>
                <small>
                  疲労{encouragementRecommendation.fatigue}・
                  {
                    getPlayerConditionPresentation(
                      encouragementRecommendation.condition,
                    ).label
                  }
                </small>
              </button>
            ) : null}
          </div>
          <div aria-label="選手への個別指示" role="group">
            {directivePlayers.map((player) => {
              const canFocusAttack =
                rotationPlayerIds.has(player.id) &&
                player.preferredPosition !== "L";
              return (
                <article key={player.id}>
                  <div>
                    <strong>{playerName(player)}</strong>
                    <small>{player.preferredPosition}</small>
                  </div>
                  <span>
                    総合 <b>{playerOverallGrade(player)}</b>・攻撃
                    <b>{playerAttackGrade(player)}</b>・疲労{player.fatigue}
                  </span>
                  <div>
                    <button
                      aria-label={`攻撃を集める ${playerName(player)}`}
                      disabled={pending || !canFocusAttack}
                      onClick={() => {
                        setPlayerDirectiveOpen(false);
                        void onCommand({
                          type: "focus-attacker",
                          playerId: player.id,
                        });
                      }}
                      type="button"
                    >
                      攻撃を集める
                    </button>
                    <button
                      aria-label={`声をかける ${playerName(player)}`}
                      disabled={pending}
                      onClick={() => {
                        setPlayerDirectiveOpen(false);
                        void onCommand({
                          type: "encourage-player",
                          playerId: player.id,
                        });
                      }}
                      type="button"
                    >
                      声をかける
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <small className="match-command-player-directive__note">
            攻撃集中：指定選手へのトス選択が増加 /
            声かけ：判断・メンタルが一時上昇
          </small>
        </div>
      </BottomSheet>

      <BottomSheet
        className="match-command-opponent-targeting-sheet"
        description="5ラリーだけ、相手の誰を狙うか指定します。相手の非公開能力は表示しません。"
        onClose={() => setOpponentTargetOpen(false)}
        open={opponentTargetOpen}
        title="相手を狙う"
      >
        <div className="match-command-opponent-targeting">
          <section aria-label="サーブで狙う相手">
            <div>
              <strong>サーブで狙う</strong>
              <small>コート上の選手・リベロから選択</small>
            </div>
            <div className="match-command-opponent-targeting__grid">
              {serveTargetPlayers.map((player) => {
                const isLibero = player.isLibero;
                return (
                  <button
                    aria-label={`サーブで狙う ${playerName(player)}`}
                    className={
                      player.id === liveServeTargetId
                        ? "is-recommended"
                        : undefined
                    }
                    disabled={pending}
                    key={player.id}
                    onClick={() => {
                      setOpponentTargetOpen(false);
                      void onCommand({
                        type: "target-serve-receiver",
                        playerId: player.id,
                      });
                    }}
                    type="button"
                  >
                    <strong>{playerName(player)}</strong>
                    <small>
                      {player.preferredPosition}・
                      {isLibero ? "リベロ" : "コート"}
                      {player.id === liveServeTargetId ? "・おすすめ" : ""}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label="ブロックで警戒する相手">
            <div>
              <strong>ブロックで警戒</strong>
              <small>OH・MB・OPから選択</small>
            </div>
            <div className="match-command-opponent-targeting__grid">
              {blockTargetPlayers.map((player) => (
                <button
                  aria-label={`ブロックで警戒 ${playerName(player)}`}
                  className={
                    player.id === liveBlockTargetId
                      ? "is-recommended"
                      : undefined
                  }
                  disabled={pending}
                  key={player.id}
                  onClick={() => {
                    setOpponentTargetOpen(false);
                    void onCommand({
                      type: "mark-opponent-attacker",
                      playerId: player.id,
                    });
                  }}
                  type="button"
                >
                  <strong>{playerName(player)}</strong>
                  <small>
                    {player.preferredPosition}・コート
                    {player.id === liveBlockTargetId ? "・おすすめ" : ""}
                  </small>
                </button>
              ))}
            </div>
          </section>

          <small className="match-command-opponent-targeting__note">
            指示は5ラリーで終了し、通常のチーム戦術は変更しません。
          </small>
        </div>
      </BottomSheet>

      <BottomSheet
        description="この試合だけの戦術を3項目まとめて変更します。"
        onClose={() => setTacticsOpen(false)}
        open={tacticsOpen}
        title="戦術変更"
      >
        <div className="match-command-tactics">
          <section
            aria-label="戦術プリセット"
            className="match-command-tactics__presets"
          >
            {tacticPresets.map((preset) => (
              <button
                disabled={pending}
                key={preset.label}
                onClick={() => setDraftPlan({ ...preset.plan })}
                type="button"
              >
                <strong>{preset.label}</strong>
                <small>{preset.detail}</small>
              </button>
            ))}
          </section>
          <div
            className="match-command-tactics__current"
            aria-label="変更後の戦術"
          >
            <span>
              サーブ
              <strong>
                {
                  serveTacticOptions.find(
                    (option) => option.value === tacticsDraft.serve,
                  )?.label
                }
              </strong>
            </span>
            <span>
              攻撃
              <strong>
                {
                  attackTacticOptions.find(
                    (option) => option.value === tacticsDraft.attack,
                  )?.label
                }
              </strong>
            </span>
            <span>
              ブロック
              <strong>
                {
                  blockTacticOptions.find(
                    (option) => option.value === tacticsDraft.block,
                  )?.label
                }
              </strong>
            </span>
          </div>
          <TacticChoiceGroup
            label="サーブ方針"
            onChange={(serve) => updateTactics("serve", serve)}
            options={serveTacticOptions}
            pending={pending}
            value={tacticsDraft.serve}
          />
          <TacticChoiceGroup
            label="攻撃方針"
            onChange={(attack) => updateTactics("attack", attack)}
            options={attackTacticOptions}
            pending={pending}
            value={tacticsDraft.attack}
          />
          <TacticChoiceGroup
            label="ブロック方針"
            onChange={(block) => updateTactics("block", block)}
            options={blockTacticOptions}
            pending={pending}
            value={tacticsDraft.block}
          />
          <button
            className="match-command-tactics__submit"
            disabled={pending}
            onClick={submitTactics}
            type="button"
          >
            この戦術で続ける
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        description={
          outgoingPlayer
            ? "ベンチから交代で入る選手を選んでください。"
            : "現在コートにいる6人から交代する選手を選んでください。"
        }
        onClose={closeSubstitution}
        open={substitutionOpen}
        title="選手交代"
      >
        <div className="match-command-substitution">
          <div
            aria-label="交代手順"
            className="match-command-substitution__progress"
          >
            <span
              className={
                outgoingPlayer
                  ? "match-command-substitution__progress-step is-complete"
                  : "match-command-substitution__progress-step is-active"
              }
            >
              <b>1</b>
              OUTを選ぶ
            </span>
            <i aria-hidden="true" />
            <span
              className={
                outgoingPlayer
                  ? "match-command-substitution__progress-step is-active"
                  : "match-command-substitution__progress-step"
              }
            >
              <b>2</b>
              INを選ぶ
            </span>
          </div>

          {!outgoingPlayer ? (
            <>
              <div className="match-command-substitution__court-label">
                <span>ON COURT</span>
                <strong>下げる選手をタップ</strong>
              </div>
              <section
                aria-label="コートの選手"
                className="match-command-substitution__court"
                role="group"
              >
                {courtPlayers.map((player) => (
                  <SubstitutionPlayerButton
                    key={player.id}
                    onSelect={() => selectOutgoingPlayer(player.id)}
                    pending={pending}
                    player={player}
                    selected={false}
                    slot={courtSlotByPlayerId.get(player.id)}
                  />
                ))}
              </section>
            </>
          ) : (
            <>
              <div className="match-command-substitution__selected-out">
                <span>OUT</span>
                <div>
                  <small>コートから下げる選手</small>
                  <strong>{playerName(outgoingPlayer)}</strong>
                </div>
                <button
                  disabled={pending}
                  onClick={() => {
                    setOutgoingPlayerId(null);
                    setIncomingPlayerId(null);
                  }}
                  type="button"
                >
                  変更
                </button>
              </div>
              <div className="match-command-substitution__court-label">
                <span>BENCH</span>
                <strong>入れる選手をタップ</strong>
              </div>
              <section
                aria-label="ベンチ"
                className="match-command-substitution__bench"
                role="group"
              >
                {benchPlayers.map((player) => (
                  <SubstitutionPlayerButton
                    key={player.id}
                    onSelect={() => setIncomingPlayerId(player.id)}
                    pending={pending}
                    player={player}
                    priorityLabel={
                      opportunityRequests[player.id]
                        ? opportunityRequests[player.id]!.kind === "promise"
                          ? "出場約束"
                          : "出場要望"
                        : undefined
                    }
                    selected={player.id === incomingPlayerId}
                  />
                ))}
              </section>
              {incomingPlayer ? (
                <div className="match-command-substitution__swap-preview">
                  <span>
                    <small>OUT</small>
                    <strong>{playerName(outgoingPlayer)}</strong>
                  </span>
                  <b aria-hidden="true">→</b>
                  <span>
                    <small>IN</small>
                    <strong>{playerName(incomingPlayer)}</strong>
                  </span>
                  <p aria-label="交代内容">
                    {playerName(outgoingPlayer)} → {playerName(incomingPlayer)}
                  </p>
                </div>
              ) : null}
              <button
                className="match-command-substitution__submit"
                disabled={pending || !incomingPlayer}
                onClick={submitSubstitution}
                type="button"
              >
                この交代を実行
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
