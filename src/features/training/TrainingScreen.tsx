import { useMemo, useState } from "react";
import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import type { WeeklyPlan } from "../../domain/training/resolveWeeklyTraining";
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
  completed: boolean;
  onSave: (plan: WeeklyPlan) => void | Promise<void>;
}

type AssignmentSlot = 1 | 2;
type TrainingSheet =
  | "team-menu"
  | "assignment-1"
  | "assignment-2"
  | "player-1"
  | "player-2"
  | "instruction-1"
  | "instruction-2"
  | "confirm"
  | null;

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function TrainingScreen({
  state,
  data,
  completed,
  onSave,
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
  const savedPlan = state.weeklySchedule.trainingPlan;
  const savedFirst = savedPlan.individualAssignments[0];
  const savedSecond = savedPlan.individualAssignments[1];
  const [teamTrainingMenuId, setTeamTrainingMenuId] = useState(
    savedPlan.teamTrainingMenuId || menus[0]?.id || "",
  );
  const [firstPlayerId, setFirstPlayerId] = useState<PlayerId>(
    savedFirst?.playerId ?? players[0]?.id ?? ("" as PlayerId),
  );
  const [secondPlayerId, setSecondPlayerId] = useState<PlayerId>(
    savedSecond?.playerId ?? players[1]?.id ?? ("" as PlayerId),
  );
  const [firstInstructionId, setFirstInstructionId] = useState(
    savedFirst?.instructionId ?? instructions[0]?.id ?? "",
  );
  const [secondInstructionId, setSecondInstructionId] = useState(
    savedSecond?.instructionId ??
      instructions[1]?.id ??
      instructions[0]?.id ??
      "",
  );
  const [sheet, setSheet] = useState<TrainingSheet>(null);

  const selectedMenu = data.trainingMenus.get(teamTrainingMenuId);
  const firstPlayer = state.players[firstPlayerId];
  const secondPlayer = state.players[secondPlayerId];
  const firstInstruction =
    data.individualTrainingInstructions.get(firstInstructionId);
  const secondInstruction =
    data.individualTrainingInstructions.get(secondInstructionId);
  const duplicatePlayers = firstPlayerId === secondPlayerId;
  const canSave =
    teamTrainingMenuId.length > 0 &&
    Boolean(firstPlayer) &&
    Boolean(secondPlayer) &&
    firstInstructionId.length > 0 &&
    secondInstructionId.length > 0 &&
    !duplicatePlayers;
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

  const save = () => {
    if (!canSave || completed) return;
    setSheet(null);
    void onSave(plan);
  };

  const assignmentSlot: AssignmentSlot =
    sheet === "assignment-2" ||
    sheet === "player-2" ||
    sheet === "instruction-2"
      ? 2
      : 1;
  const pickerSlot: AssignmentSlot | null =
    sheet === "player-1" ? 1 : sheet === "player-2" ? 2 : null;
  const pickerCurrentId = pickerSlot === 1 ? firstPlayerId : secondPlayerId;
  const pickerOtherId = pickerSlot === 1 ? secondPlayerId : firstPlayerId;

  const selectPlayer = (playerId: PlayerId) => {
    if (pickerSlot === 1) {
      setFirstPlayerId(playerId);
      setSheet("assignment-1");
    } else if (pickerSlot === 2) {
      setSecondPlayerId(playerId);
      setSheet("assignment-2");
    }
  };

  const assignmentPlayer = assignmentSlot === 1 ? firstPlayer : secondPlayer;
  const assignmentInstruction =
    assignmentSlot === 1 ? firstInstruction : secondInstruction;

  return (
    <main className="app-content training-screen training-screen--compact">
      <header className="training-screen__header">
        <h2>育成</h2>
        <span>
          {completed ? "今週は実施済み" : `平均疲労 ${averageFatigue}`}
        </span>
      </header>

      {state.shopEffects?.nextTrainingGrowthBoost ? (
        <p className="training-shop-boost" role="status">
          次回練習 成長効率 +{state.shopEffects.nextTrainingGrowthBoost.percent}
          %
        </p>
      ) : null}

      <section className="training-setup-card" aria-label="今週の練習設定">
        <button
          aria-label={`チーム練習 ${selectedMenu?.name ?? "未設定"} を変更`}
          className="training-compact-row training-compact-row--team"
          disabled={completed}
          onClick={() => setSheet("team-menu")}
          type="button"
        >
          <span className="training-compact-row__main">
            <span className="training-compact-row__label">チーム練習</span>
            <strong>{selectedMenu?.name ?? "未設定"}</strong>
            <small>
              {selectedMenu
                ? `成長 ${signed(selectedMenu.baseGrowth)} / 疲労 ${signed(selectedMenu.fatigue)} / 怪我 ${selectedMenu.injuryRisk}%`
                : "練習メニューを選択"}
            </small>
          </span>
          <span className="training-compact-row__action" aria-hidden="true">
            変更 ›
          </span>
        </button>

        {[1, 2].map((slotValue) => {
          const slot = slotValue as AssignmentSlot;
          const player = slot === 1 ? firstPlayer : secondPlayer;
          const instruction = slot === 1 ? firstInstruction : secondInstruction;
          return player ? (
            <button
              aria-label={`個人育成 ${slot} ${player.lastName} ${player.firstName} ${instruction?.name ?? "指示未設定"}`}
              className="training-compact-row training-compact-row--individual"
              disabled={completed}
              key={slot}
              onClick={() => setSheet(`assignment-${slot}`)}
              type="button"
            >
              <span className="training-compact-row__index">{slot}</span>
              <span className="training-compact-row__main">
                <span className="training-compact-row__label">個人育成</span>
                <strong>
                  {player.lastName} {player.firstName}
                </strong>
                <small>{instruction?.name ?? "指示未設定"}</small>
              </span>
              <span
                className="training-compact-row__chevron"
                aria-hidden="true"
              >
                ›
              </span>
            </button>
          ) : null;
        })}
      </section>

      <StickyActionBar
        disabled={completed || !canSave}
        label={completed ? "今週の練習は完了" : "この内容で設定"}
        onClick={() => setSheet("confirm")}
        summary={
          completed
            ? "次の週へ進めます"
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
        description="選手と育成内容をまとめて変更できます。"
        onClose={() => setSheet(null)}
        open={sheet === "assignment-1" || sheet === "assignment-2"}
        title={`個人育成 ${assignmentSlot}`}
      >
        <div className="training-assignment-editor">
          <div className="training-assignment-editor__summary">
            <span>選手</span>
            <strong>
              {assignmentPlayer?.lastName} {assignmentPlayer?.firstName}
            </strong>
            <small>{assignmentInstruction?.name ?? "指示未設定"}</small>
          </div>
          <button
            onClick={() => setSheet(`player-${assignmentSlot}`)}
            type="button"
          >
            選手を変更
          </button>
          <button
            onClick={() => setSheet(`instruction-${assignmentSlot}`)}
            type="button"
          >
            指示を変更
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        description="選手カードをタップすると、この枠へ設定します。"
        onClose={() => setSheet(`assignment-${pickerSlot ?? 1}`)}
        open={pickerSlot !== null}
        title={`個人育成${pickerSlot ?? ""}の選手を選択`}
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
        onClose={() => setSheet(`assignment-${assignmentSlot}`)}
        open={sheet === "instruction-1" || sheet === "instruction-2"}
        title={`個人育成${assignmentSlot}の指示を選択`}
      >
        <div className="training-instruction-sheet">
          {instructions.map((instruction) => {
            const selected =
              assignmentSlot === 1
                ? firstInstructionId === instruction.id
                : secondInstructionId === instruction.id;
            return (
              <ChoiceChip
                key={instruction.id}
                label={instruction.name}
                onClick={() => {
                  if (assignmentSlot === 1) {
                    setFirstInstructionId(instruction.id);
                    setSheet("assignment-1");
                  } else {
                    setSecondInstructionId(instruction.id);
                    setSheet("assignment-2");
                  }
                }}
                selected={selected}
                testId="individual-instruction-choice"
              />
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet
        description="この設定は「次の週へ」で実施されます。週を進めるまでは変更できます。"
        onClose={() => setSheet(null)}
        open={sheet === "confirm"}
        title="練習設定を確認"
      >
        <div className="training-confirmation">
          <article>
            <span>チーム練習</span>
            <strong>{selectedMenu?.name}</strong>
          </article>
          <article>
            <span>個人育成1</span>
            <strong>
              {firstPlayer?.lastName}・{firstInstruction?.name}
            </strong>
          </article>
          <article>
            <span>個人育成2</span>
            <strong>
              {secondPlayer?.lastName}・{secondInstruction?.name}
            </strong>
          </article>
          <button
            className="training-confirm-button"
            disabled={!canSave}
            onClick={save}
            type="button"
          >
            この内容で設定
          </button>
        </div>
      </BottomSheet>
    </main>
  );
}
