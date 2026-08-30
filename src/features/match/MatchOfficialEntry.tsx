import type { GameState } from "../../domain/model/GameState";
import { selectNextOfficialEvent } from "../../domain/tournament/tournamentSelectors";
import type {
  TournamentCircuit,
  TournamentLevel,
} from "../../domain/tournament/tournamentTypes";
import "./matchOfficialEntry.css";

interface MatchOfficialEntryProps {
  state: GameState;
  onOpen: () => void;
}

const circuitLabels: Record<TournamentCircuit, string> = {
  interhigh: "インターハイ",
  "spring-high": "春高",
};

const levelLabels: Record<TournamentLevel, string> = {
  prefectural: "県大会",
  national: "全国大会",
};

export function MatchOfficialEntry({ state, onOpen }: MatchOfficialEntryProps) {
  const nextOfficial = selectNextOfficialEvent(state);

  if (!nextOfficial) {
    return null;
  }

  const timingLabel =
    nextOfficial.weeksUntil === 0 ? "今週" : `あと${nextOfficial.weeksUntil}週`;
  const tournamentLabel = `${circuitLabels[nextOfficial.circuit]} ${levelLabels[nextOfficial.level]}`;
  const detail =
    nextOfficial.kind === "match"
      ? `対戦: ${nextOfficial.opponent.displayName}`
      : "次の大会に向けて準備を進めましょう";

  return (
    <section
      className="match-official-entry"
      aria-labelledby="match-official-entry-heading"
    >
      <div className="match-official-entry__copy">
        <p className="section-kicker">OFFICIAL</p>
        <h2 id="match-official-entry-heading">公式大会</h2>
        <strong>{tournamentLabel}</strong>
        <p>{detail}</p>
      </div>
      <span className="match-official-entry__timing">{timingLabel}</span>
      <button aria-label="大会表を見る" onClick={onOpen} type="button">
        大会表を見る
      </button>
    </section>
  );
}
