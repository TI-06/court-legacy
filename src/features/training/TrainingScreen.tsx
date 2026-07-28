import { useMemo, useState } from "react";
import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import type {
  TrainingResult,
  WeeklyPlan,
} from "../../domain/training/resolveWeeklyTraining";
import type { AbilityKey } from "../../domain/validation/gameDataSchema";
import "./training.css";

interface TrainingScreenProps {
  state: GameState;
  data: GameDataRegistry;
  latestResult: TrainingResult | null;
  onExecute: (plan: WeeklyPlan) => void;
}

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

  const duplicatePlayers = firstPlayerId === secondPlayerId;
  const canExecute =
    teamTrainingMenuId.length > 0 &&
    firstPlayerId.length > 0 &&
    secondPlayerId.length > 0 &&
    firstInstructionId.length > 0 &&
    secondInstructionId.length > 0 &&
    !duplicatePlayers;

  const selectedMenu = data.trainingMenus.get(teamTrainingMenuId);
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

  return (
    <main className="app-content training-screen">
      <section className="training-hero" aria-labelledby="training-heading">
        <p className="section-kicker">WEEKLY DEVELOPMENT</p>
        <div className="training-hero__title">
          <div>
            <h2 id="training-heading">週間練習</h2>
            <p>チーム方針1件と、異なる選手への個人指示2件を設定します。</p>
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
        <label className="field-label" htmlFor="team-training-menu">
          チーム練習
        </label>
        <div className="select-wrap">
          <select
            aria-label="チーム練習"
            id="team-training-menu"
            onChange={(event) => setTeamTrainingMenuId(event.target.value)}
            value={teamTrainingMenuId}
          >
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name}
              </option>
            ))}
          </select>
        </div>
        {selectedMenu ? (
          <div className="menu-summary">
            <p>{selectedMenu.description}</p>
            <div className="menu-summary__meta">
              <span>成長 {selectedMenu.baseGrowth}</span>
              <span>疲労 {signed(selectedMenu.fatigue)}</span>
              <span>怪我 {selectedMenu.injuryRisk}%</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="training-panel" aria-labelledby="individual-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">INDIVIDUAL ORDERS</p>
            <h2 id="individual-heading">個人指示</h2>
          </div>
          <span className="training-step">2–3 / 3</span>
        </div>

        <div className="assignment-card">
          <div className="assignment-card__number">1</div>
          <div className="assignment-card__fields">
            <label className="field-label" htmlFor="first-player">
              選手
            </label>
            <div className="select-wrap">
              <select
                aria-label="個人指示1 選手"
                id="first-player"
                onChange={(event) =>
                  setFirstPlayerId(event.target.value as PlayerId)
                }
                value={firstPlayerId}
              >
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.lastName} {player.firstName}｜{player.grade}年・
                    {player.preferredPosition}
                  </option>
                ))}
              </select>
            </div>
            <label className="field-label" htmlFor="first-instruction">
              指示内容
            </label>
            <div className="select-wrap">
              <select
                aria-label="個人指示1 内容"
                id="first-instruction"
                onChange={(event) => setFirstInstructionId(event.target.value)}
                value={firstInstructionId}
              >
                {instructions.map((instruction) => (
                  <option key={instruction.id} value={instruction.id}>
                    {instruction.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="assignment-card">
          <div className="assignment-card__number">2</div>
          <div className="assignment-card__fields">
            <label className="field-label" htmlFor="second-player">
              選手
            </label>
            <div className="select-wrap">
              <select
                aria-label="個人指示2 選手"
                id="second-player"
                onChange={(event) =>
                  setSecondPlayerId(event.target.value as PlayerId)
                }
                value={secondPlayerId}
              >
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.lastName} {player.firstName}｜{player.grade}年・
                    {player.preferredPosition}
                  </option>
                ))}
              </select>
            </div>
            <label className="field-label" htmlFor="second-instruction">
              指示内容
            </label>
            <div className="select-wrap">
              <select
                aria-label="個人指示2 内容"
                id="second-instruction"
                onChange={(event) => setSecondInstructionId(event.target.value)}
                value={secondInstructionId}
              >
                {instructions.map((instruction) => (
                  <option key={instruction.id} value={instruction.id}>
                    {instruction.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {duplicatePlayers ? (
          <p className="form-error" role="alert">
            個人指示は異なる選手を選んでください。
          </p>
        ) : null}

        <button
          className="primary-action training-submit"
          disabled={!canExecute}
          onClick={submit}
          type="button"
        >
          練習を実行
        </button>
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
              const changedAbilities = Object.entries(log.abilityChanges).filter(
                ([, value]) => (value ?? 0) !== 0,
              ) as Array<[AbilityKey, number]>;

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
    </main>
  );
}
