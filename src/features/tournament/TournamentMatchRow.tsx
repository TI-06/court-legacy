import type { ReactNode } from "react";
import type { TournamentBracketMatchView } from "../../domain/tournament/tournamentSelectors";

interface TournamentMatchRowProps {
  match: TournamentBracketMatchView;
  userEntrantId: string | null;
  action?: ReactNode;
}

function entrantLabel(entrant: TournamentBracketMatchView["home"]): string {
  return entrant?.shortName ?? "未定";
}

function entrantAccessibleLabel(
  entrant: TournamentBracketMatchView["home"],
): string {
  return entrant?.displayName ?? "未定";
}

export function TournamentMatchRow({
  match,
  userEntrantId,
  action,
}: TournamentMatchRowProps) {
  const completed = match.homeSetsWon !== null && match.awaySetsWon !== null;
  const homeIsUser = Boolean(
    userEntrantId && match.home?.entrantId === userEntrantId,
  );
  const awayIsUser = Boolean(
    userEntrantId && match.away?.entrantId === userEntrantId,
  );

  return (
    <article
      className={`tournament-match-row${
        match.userInMatch ? " tournament-match-row--user" : ""
      }${action ? " tournament-match-row--action" : ""}`}
      data-testid="tournament-bracket-match"
    >
      <div
        aria-label={`${entrantAccessibleLabel(match.home)} ${
          completed ? match.homeSetsWon : "対"
        } ${completed ? match.awaySetsWon : ""} ${entrantAccessibleLabel(match.away)}`}
        className="tournament-match-row__line"
        data-testid="tournament-match-line"
      >
        <span
          className={`tournament-match-row__school tournament-match-row__school--home${
            homeIsUser ? " is-user" : ""
          }`}
          title={entrantAccessibleLabel(match.home)}
        >
          {entrantLabel(match.home)}
        </span>
        <strong className="tournament-match-row__center">
          {completed ? `${match.homeSetsWon} - ${match.awaySetsWon}` : "VS"}
        </strong>
        <span
          className={`tournament-match-row__school tournament-match-row__school--away${
            awayIsUser ? " is-user" : ""
          }`}
          title={entrantAccessibleLabel(match.away)}
        >
          {entrantLabel(match.away)}
        </span>
      </div>
      {action ? (
        <div className="tournament-match-row__action">{action}</div>
      ) : null}
    </article>
  );
}
