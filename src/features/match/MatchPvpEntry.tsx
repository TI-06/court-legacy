import "./match.css";

interface MatchPvpEntryProps {
  onOpen: () => void;
}

export function MatchPvpEntry({ onOpen }: MatchPvpEntryProps) {
  return (
    <section
      className="match-pvp-entry"
      aria-labelledby="match-pvp-entry-heading"
    >
      <div className="match-pvp-entry__copy">
        <p className="section-kicker">ONLINE ARENA</p>
        <h2 id="match-pvp-entry-heading">対人戦</h2>
        <p>
          育てたチームを公開して、他プレイヤーの高校へレーティング戦を挑みます。
        </p>
      </div>
      <div className="match-pvp-entry__badge" aria-hidden="true">
        <span>RATED</span>
        <strong>VS</strong>
      </div>
      <button aria-label="対人戦を開く" onClick={onOpen} type="button">
        公開チームと対戦
      </button>
    </section>
  );
}
