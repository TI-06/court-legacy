import type { MatchGrowthPresentation } from "../../domain/player/abilityGrowthPresentation";
import type { AbilityKey } from "../../domain/validation/gameDataSchema";
import { BottomSheet } from "../../ui/BottomSheet";
import "./match-growth-result.css";

interface MatchGrowthResultSheetProps {
  growth: MatchGrowthPresentation | null;
  open: boolean;
  onClose: () => void;
}

const abilityLabels: Record<AbilityKey, string> = {
  spike: "スパイク",
  jump: "ジャンプ",
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

export function MatchGrowthResultSheet({
  growth,
  open,
  onClose,
}: MatchGrowthResultSheetProps) {
  return (
    <BottomSheet
      description={
        growth
          ? `試合経験による能力成長 合計 ${signed(growth.totalAbilityGrowth)}`
          : undefined
      }
      onClose={onClose}
      open={open && growth !== null}
      title="試合後の成長"
    >
      {growth ? (
        <div className="match-growth-result">
          {growth.players.length > 0 ? (
            <div className="match-growth-result__players">
              {growth.players.map((player) => (
                <article
                  className="match-growth-result__player"
                  key={player.playerId}
                >
                  <header>
                    <span>
                      <strong>{player.displayName}</strong>
                      <small>
                        {player.grade}年・{player.preferredPosition}
                      </small>
                    </span>
                    <b>{signed(player.totalAbilityGrowth)}</b>
                  </header>
                  <div className="match-growth-result__abilities">
                    {player.changes.map((change) => (
                      <div key={change.ability}>
                        <strong>{abilityLabels[change.ability]}</strong>
                        <span>
                          {change.beforeGrade}
                          {change.before}
                          <em aria-hidden="true">→</em>
                          <b>
                            {change.afterGrade}
                            {change.after}
                          </b>
                        </span>
                        <small>{signed(change.delta)}</small>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="match-growth-result__empty">
              今回の試合では能力値の上昇はありませんでした。
            </p>
          )}
        </div>
      ) : null}
    </BottomSheet>
  );
}
