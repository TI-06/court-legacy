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

interface TrainingScreenProps {
  state: GameState;
  data: GameDataRegistry;
  latestResult: TrainingResult | null;
  onExecute: (plan: WeeklyPlan) => void;
}

type AssignmentSlot = 1 | 2;

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
  const [pickerSlot, setPickerSlot] = useState<AssignmentSlot | null>(null);

  const selectedMenu = data.trainingMenus.get(teamTrainingMenuId);
  const firstPlayer = state.players[firstPlayerId];
  const secondPlayer = state.players[secondPlayerId];
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

  const submit = () => {
    if (!canExecute) {
      return;
    }

    onExecute({
      teamTrainingMenuId,
      individualAssignments: [
        { playerId: firstPlayerId, instructionId: firstInstructionId },
        { playerId: secondPlayerId, instructionId: secondInstructionId },
      ],
    });
  };

  const selectPlayer = (playerId: PlayerId) => {
    if (pickerSlot === 1) {
      setFirstPlayerId(playerId);
    } else if (pickerSlot === 2) {
      setSecondPlayerId(playerId);
    }
    setPickerSlot(null);
  };

  const pickerCurrentId = pickerSlot === 1 ? firstPlayerId : secondPlayerId;
  const pickerOtherId = pickerSlot === 1 ? secondPlayerId : firstPlayerId;

  return (
    <main className="app-content training-screen">
      <section className="training-hero" aria-labelledby="training-heading">
        <p className="section-kicker">WEEKLY DEVELOPMENT</p>
        <div className="training-hero__title">
          <div>
            <h2 id="training-heading">週間練習</h2>
            <p>カードをタップして、今週の練習方針を決めます。</p>
          </div>
          <span>{school.shortName}</span>
        </div>
      </section>

      <section className="training-panel" aria-labelledby="team-menu-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">TEAM MENU</p>
            <h2 id="team-menu-heading">チーム練習</h2>
          </div>
          <span className="training-step">1 / 3</span>
        </div>
        <div
          aria-label="チーム練習を選択"
          className="training-choice-rail"
          role="group"
        >
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
              onClick={() => setTeamTrainingMenuId(menu.id)}
              selected={teamTrainingMenuId === menu.id}
              testId="team-training-choice"
              title={menu.name}
            />
          ))}
        </div>
      </section>

      <section className="training-panel" aria-labelledby="individual-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">INDIVIDUAL ORDERS</p>
            <h2 id="individual-heading">個人指示</h2>
          </div>
          <span className="training-step">2–3 / 3</span>
        </div>

        <div className="direct-assignment-list">
          {firstPlayer ? (
            <article className="direct-assignment-card">
              <div className="direct-assignment-card__heading">
                <span>1</span>
                <strong>重点選手</strong>
              </div>
              <PlayerTile
                actionLabel="変更"
                ariaLabel="個人指示1の選手を変更"
                onClick={() => setPickerSlot(1)}
                player={firstPlayer}
                selected
              />
              <div
                aria-label="個人指示1の内容"
                className="instruction-chip-list"
                role="group"
              >
                {instructions.map((instruction) => (
                  <ChoiceChip
                    key={instruction.id}
                    label={instruction.name}
                    onClick={() => setFirstInstructionId(instruction.id)}
                    selected={firstInstructionId === instruction.id}
                    testId="individual-instruction-1"
                  />
                ))}
              </div>
            </article>
          ) : null}

          {secondPlayer ? (
            <article className="direct-assignment-card">
              <div className="direct-assignment-card__heading">
                <span>2</span>
                <strong>重点選手</strong>
              </div>
              <PlayerTile
                actionLabel="変更"
                ariaLabel="個人指示2の選手を変更"
                onClick={() => setPickerSlot(2)}
                player={secondPlayer}
                selected
              />
              <div
                aria-label="個人指示2の内容"
                className="instruction-chip-list"
                role="group"
              >
                {instructions.map((instruction) => (
                  <ChoiceChip
                    key={instruction.id}
                    label={instruction.name}
                    onClick={() => setSecondInstructionId(instruction.id)}
                    selected={secondInstructionId === instruction.id}
                    testId="individual-instruction-2"
                  />
                ))}
              </div>
            </article>
          ) : null}
        </div>
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
                <article data-testid="training-result-player" key={log.playerId}>
                  <div className="player-result__header">
                    <div>
                      <strong>
                        {player.lastName} {player.firstName}
                      </strong>
                      <span>
                        {player.grade}年・{player.preferredPosition}
                      </span>
                    </div>
                    {log.injury ? (
                      <span className="injury-label">怪我</span>
                    ) : log.skippedReason === "injured" ? (
                      <span className="injury-label">療養中</span>
                    ) : (
                      <span className="growth-label">
                        能力成長 +{log.totalAbilityGrowth}
                      </span>
                    )}
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
                  ) : (
                    <p className="result-note">
                      {log.skippedReason === "injured"
                        ? "怪我のため通常練習を見送りました。"
                        : "能力値は上限または補正により変化しませんでした。"}
                    </p>
                  )}
                  {log.modifiers.length > 0 ? (
                    <details className="modifier-details">
                      <summary>成長理由を確認</summary>
                      <div>
                        {log.modifiers.map((modifier) => (
                          <span key={modifier.code}>
                            {modifier.label} {modifier.percent}%
                          </span>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <StickyActionBar
        disabled={!canExecute}
        label="練習を実行"
        onClick={submit}
        summary={
          selectedMenu && firstPlayer && secondPlayer
            ? `${selectedMenu.name}｜${firstPlayer.lastName}・${secondPlayer.lastName}`
            : "練習内容を設定してください"
        }
      />

      <BottomSheet
        description="選手カードをタップすると、この枠へ設定します。"
        onClose={() => setPickerSlot(null)}
        open={pickerSlot !== null}
        title={`個人指示${pickerSlot ?? ""}の選手を選択`}
      >
        <div className="ui-player-picker-list">
          {players.map((player) => {
            const isCurrent = player.id === pickerCurrentId;
            const isOther = player.id === pickerOtherId;
            return (
              <PlayerTile
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
    </main>
  );
}
