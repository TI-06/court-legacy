import { useMemo, useState } from "react";
import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import type {
  TrainingResult,
  WeeklyPlan,
} from "../../domain/training/resolveWeeklyTraining";
import type { AbilityKey } from "../../domain/validation/gameDataSchema";
import { BottomSheet } from "../../ui/BottomSheet";
import { ChoiceCard } from "../../ui/ChoiceCard";
import { ChoiceChip } from "../../ui/ChoiceChip";
import { PlayerTile } from "../../ui/PlayerTile";
import { StickyActionBar } from "../../ui/StickyActionBar";
import "../../ui/ui.css";
import "./training.css";
import "./training-direct.css";

interface TrainingScreenProps {
  state: GameState;
  data: GameDataRegistry;
  latestResult: TrainingResult | null;
  completed: boolean;
  onExecute: (plan: WeeklyPlan) => void;
}

type AssignmentSlot = 1 | 2;
type TrainingSheet =
  | "team-menu"
  | "player-1"
  | "player-2"
  | "instruction-1"
  | "instruction-2"
  | "confirm"
  | null;

const abilityLabels: Record<AbilityKey, string> = {
  spike: "スパイク",
  jump: "跳躍",
  receive: "レシーブ",
  serve: "サーブ",
  set: "トス",
  block: "ブロック",
  speed: "スピード",
  stamina: "スタミナ",
  decision: "判断",
  mental: "メンタル",
};

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function TrainingScreen({
  state,
  data,
  latestResult,
  completed,
  onExecute,
}: TrainingScreenProps) {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const players = useMemo(
    () =>
      school.playerIds.map((playerId) => {
        const player = state.players[playerId];
        if (!player) {
          throw new Error(`school references unknown player: ${playerId}`);
        }
        return player;
      }),
    [school.playerIds, state.players],
  );
  const menus = useMemo(() => [...data.trainingMenus.values()], [data]);
  const instructions = useMemo(
    () => [...data.individualTrainingInstructions.values()],
    [data],
  );
  const [teamTrainingMenuId, setTeamTrainingMenuId] = useState(
    menus[0]?.id ?? "",
  );
  const [firstPlayerId, setFirstPlayerId] = useState<PlayerId>(
    players[0]?.id ?? ("" as PlayerId),
  );
  const [secondPlayerId, setSecondPlayerId] = useState<PlayerId>(
    players[1]?.id ?? ("" as PlayerId),
  );
  const [firstInstructionId, setFirstInstructionId] = useState(
    instructions[0]?.id ?? "",
  );
  const [secondInstructionId, setSecondInstructionId] = useState(
    instructions[1]?.id ?? instructions[0]?.id ?? "",
  );
  const [sheet, setSheet] = useState<TrainingSheet>(null);
  const [resultsExpanded, setResultsExpanded] = useState(false);

  const selectedMenu = data.trainingMenus.get(teamTrainingMenuId);
  const firstPlayer = state.players[firstPlayerId];
  const secondPlayer = state.players[secondPlayerId];
  const firstInstruction =
    data.individualTrainingInstructions.get(firstInstructionId);
  const secondInstruction =
    data.individualTrainingInstructions.get(secondInstructionId);
  const duplicatePlayers = firstPlayerId === secondPlayerId;
  const canExecute =
    teamTrainingMenuId.length > 0 &&
    Boolean(firstPlayer) &&
    Boolean(secondPlayer) &&
    firstInstructionId.length > 0 &&
    secondInstructionId.length > 0 &&
    !duplicatePlayers;
  const totalGrowth =
    latestResult?.playerLogs.reduce(
      (sum, log) => sum + log.totalAbilityGrowth,
      0,
    ) ?? 0;
  const fatigueDelta =
    latestResult?.playerLogs.reduce((sum, log) => sum + log.fatigueChange, 0) ??
    0;
  const averageFatigue = Math.round(
    players.reduce((sum, player) => sum + player.fatigue, 0) /
      Math.max(1, players.length),
  );

  const plan: WeeklyPlan = {
    teamTrainingMenuId,
    individualAssignments: [
      { playerId: firstPlayerId, instructionId: firstInstructionId },
      { playerId: secondPlayerId, instructionId: secondInstructionId },
    ],
  };

  const execute = () => {
    if (!canExecute || completed) {
      return;
    }
    setSheet(null);
    setResultsExpanded(false);
    onExecute(plan);
  };

  const pickerSlot: AssignmentSlot | null =
    sheet === "player-1" ? 1 : sheet === "player-2" ? 2 : null;
  const pickerCurrentId = pickerSlot === 1 ? firstPlayerId : secondPlayerId;
  const pickerOtherId = pickerSlot === 1 ? secondPlayerId : firstPlayerId;

  const selectPlayer = (playerId: PlayerId) => {
    if (pickerSlot === 1) {
      setFirstPlayerId(playerId);
    } else if (pickerSlot === 2) {
      setSecondPlayerId(playerId);
    }
    setSheet(null);
  };

  return (
    <main className="app-content training-screen training-screen--compact">
      <section className="training-hero" aria-labelledby="training-heading">
        <p className="section-kicker">WEEKLY DEVELOPMENT</p>
        <div className="training-hero__title">
          <div>
            <h2 id="training-heading">週間練習</h2>
            <p>今週の方針だけを確認し、変更時にメニューを開きます。</p>
          </div>
          <span>{completed ? "実施済み" : school.shortName}</span>
        </div>
      </section>

      <section className="training-panel training-plan-card">
        <div className="section-heading">
          <div>
            <p className="section-kicker">CURRENT PLAN</p>
            <h2>今週の設定</h2>
          </div>
          <span className="training-step">疲労 {averageFatigue}</span>
        </div>

        <article className="training-setting-row">
          <div>
            <span>チーム練習</span>
            <strong>{selectedMenu?.name ?? "未設定"}</strong>
            <small>
              {selectedMenu
                ? `成長 ${selectedMenu.baseGrowth}・疲労 ${signed(selectedMenu.fatigue)}・怪我 ${selectedMenu.injuryRisk}%`
                : "練習メニューを選択してください"}
            </small>
          </div>
          <button
            aria-label="チーム練習を変更"
            disabled={completed}
            onClick={() => setSheet("team-menu")}
            type="button"
          >
            変更
          </button>
        </article>

        {[1, 2].map((slotValue) => {
          const slot = slotValue as AssignmentSlot;
          const player = slot === 1 ? firstPlayer : secondPlayer;
          const instruction = slot === 1 ? firstInstruction : secondInstruction;
          return player ? (
            <article className="training-assignment-summary" key={slot}>
              <div className="training-assignment-summary__heading">
                <span>{slot}</span>
                <div>
                  <small>個人指示</small>
                  <strong>
                    {player.lastName} {player.firstName}
                  </strong>
                </div>
              </div>
              <p>{instruction?.name ?? "指示未設定"}</p>
              <div className="training-assignment-summary__actions">
                <button
                  aria-label={`個人指示${slot}の選手を変更`}
                  disabled={completed}
                  onClick={() => setSheet(`player-${slot}`)}
                  type="button"
                >
                  選手変更
                </button>
                <button
                  aria-label={`個人指示${slot}の内容を変更`}
                  disabled={completed}
                  onClick={() => setSheet(`instruction-${slot}`)}
                  type="button"
                >
                  指示変更
                </button>
              </div>
            </article>
          ) : null;
        })}
      </section>

      {latestResult ? (
        <section className="training-results" aria-labelledby="result-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">WEEKLY REPORT</p>
              <h2 id="result-heading">今週の練習結果</h2>
            </div>
            <span className="result-complete">完了</span>
          </div>
          <div className="result-summary-grid">
            <article>
              <span>能力成長</span>
              <strong>+{totalGrowth}</strong>
            </article>
            <article>
              <span>疲労</span>
              <strong>{signed(fatigueDelta)}</strong>
            </article>
            <article>
              <span>怪我</span>
              <strong>{latestResult.injuredPlayerIds.length}人</strong>
            </article>
          </div>
          <div
            className={`training-result-details${resultsExpanded ? " training-result-details--open" : ""}`}
          >
            <button
              aria-expanded={resultsExpanded}
              onClick={() => setResultsExpanded((current) => !current)}
              type="button"
            >
              選手別の結果を確認
            </button>
            {resultsExpanded ? (
              <div className="player-result-list">
                {latestResult.playerLogs.map((log) => {
                  const player = state.players[log.playerId];
                  if (!player) {
                    return null;
                  }
                  const changedAbilities = Object.entries(
                    log.abilityChanges,
                  ).filter(([, value]) => (value ?? 0) !== 0) as Array<
                    [AbilityKey, number]
                  >;
                  return (
                    <article
                      data-testid="training-result-player"
                      key={log.playerId}
                    >
                      <div className="player-result__header">
                        <div>
                          <strong>
                            {player.lastName} {player.firstName}
                          </strong>
                          <span>
                            {player.grade}年・{player.preferredPosition}
                          </span>
                        </div>
                        <span
                          className={
                            log.injury ? "injury-label" : "growth-label"
                          }
                        >
                          {log.injury
                            ? "怪我"
                            : `能力成長 +${log.totalAbilityGrowth}`}
                        </span>
                      </div>
                      <div className="player-result__metrics">
                        <span>疲労 {signed(log.fatigueChange)}</span>
                        <span>状態 {signed(log.conditionChange)}</span>
                        <span>信頼 {signed(log.trustChange)}</span>
                      </div>
                      {changedAbilities.length > 0 ? (
                        <div className="ability-change-list">
                          {changedAbilities.map(([ability, value]) => (
                            <span key={ability}>
                              {abilityLabels[ability]} {signed(value)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <StickyActionBar
        disabled={completed || !canExecute}
        label={completed ? "今週の練習は完了" : "練習を実行"}
        onClick={() => setSheet("confirm")}
        summary={
          completed
            ? "ホームから次の週へ進めます"
            : selectedMenu && firstPlayer && secondPlayer
              ? `${selectedMenu.name}｜${firstPlayer.lastName}・${secondPlayer.lastName}`
              : "練習内容を設定してください"
        }
      />

      <BottomSheet
        description="カードをタップすると今週のメニューへ設定します。"
        onClose={() => setSheet(null)}
        open={sheet === "team-menu"}
        title="チーム練習を選択"
      >
        <div className="training-sheet-choice-list">
          {menus.map((menu) => (
            <ChoiceCard
              description={menu.description}
              key={menu.id}
              meta={
                <>
                  <span>成長 {menu.baseGrowth}</span>
                  <span>疲労 {signed(menu.fatigue)}</span>
                  <span>怪我 {menu.injuryRisk}%</span>
                </>
              }
              onClick={() => {
                setTeamTrainingMenuId(menu.id);
                setSheet(null);
              }}
              selected={teamTrainingMenuId === menu.id}
              testId="team-training-choice"
              title={menu.name}
            />
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        description="選手カードをタップすると、この枠へ設定します。"
        onClose={() => setSheet(null)}
        open={pickerSlot !== null}
        title={`個人指示${pickerSlot ?? ""}の選手を選択`}
      >
        <div className="ui-player-picker-list">
          {players.map((player) => {
            const isCurrent = player.id === pickerCurrentId;
            const isOther = player.id === pickerOtherId;
            return (
              <PlayerTile
                school={school}
                actionLabel={
                  isCurrent ? "選択中" : isOther ? "別枠使用中" : "選ぶ"
                }
                disabled={isCurrent || isOther}
                key={player.id}
                onClick={() => selectPlayer(player.id)}
                player={player}
                selected={isCurrent}
                testId="player-picker-option"
              />
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet
        description="個人練習の内容を選択します。"
        onClose={() => setSheet(null)}
        open={sheet === "instruction-1" || sheet === "instruction-2"}
        title={`個人指示${sheet === "instruction-2" ? 2 : 1}の内容を選択`}
      >
        <div className="training-instruction-sheet">
          {instructions.map((instruction) => {
            const slot = sheet === "instruction-2" ? 2 : 1;
            const selected =
              slot === 1
                ? firstInstructionId === instruction.id
                : secondInstructionId === instruction.id;
            return (
              <ChoiceChip
                key={instruction.id}
                label={instruction.name}
                onClick={() => {
                  if (slot === 1) {
                    setFirstInstructionId(instruction.id);
                  } else {
                    setSecondInstructionId(instruction.id);
                  }
                  setSheet(null);
                }}
                selected={selected}
                testId="individual-instruction-choice"
              />
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet
        description="実行後は次の週まで練習内容を変更できません。"
        onClose={() => setSheet(null)}
        open={sheet === "confirm"}
        title="練習内容を確認"
      >
        <div className="training-confirmation">
          <article>
            <span>チーム練習</span>
            <strong>{selectedMenu?.name}</strong>
          </article>
          <article>
            <span>個人指示1</span>
            <strong>
              {firstPlayer?.lastName}・{firstInstruction?.name}
            </strong>
          </article>
          <article>
            <span>個人指示2</span>
            <strong>
              {secondPlayer?.lastName}・{secondInstruction?.name}
            </strong>
          </article>
          <button
            className="training-confirm-button"
            disabled={!canExecute}
            onClick={execute}
            type="button"
          >
            この内容で実行
          </button>
        </div>
      </BottomSheet>
    </main>
  );
}
