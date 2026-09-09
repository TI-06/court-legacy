from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"anchor not found: {path}\n{old}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


game_app = "src/app/GameApp.tsx"
replace_once(
    game_app,
    'import type { MatchTacticPlan } from "../domain/team/matchTactics";',
    '''import type {
  MatchTacticPlan,
  PublicTacticSummary,
} from "../domain/team/matchTactics";''',
)
replace_once(
    game_app,
    '''      opponentSelection?: TeamSelection;
    }
  | {''',
    '''      opponentSelection?: TeamSelection;
      opponentTactics?: PublicTacticSummary;
    }
  | {''',
)
replace_once(
    game_app,
    '''      opponentStrength: number;
    };''',
    '''      opponentStrength: number;
      opponentTactics?: PublicTacticSummary;
    };''',
)
replace_once(
    game_app,
    '''  const challengePvpTeam = async (
    opponentSnapshotId: string,
    matchSelection?: TeamSelection,
  ) => {''',
    '''  const challengePvpTeam = async (
    opponentSnapshotId: string,
    matchSelection?: TeamSelection,
    matchTactics?: MatchTacticPlan,
  ) => {''',
)
replace_once(
    game_app,
    '''        opponentSnapshotId,
        ...(matchSelection ? { matchSelection } : {}),
      });''',
    '''        opponentSnapshotId,
        ...(matchSelection ? { matchSelection } : {}),
        ...(matchTactics ? { matchTactics } : {}),
      });''',
)
replace_once(
    game_app,
    '''  const executeAdvanceWeek = async (matchSelection?: TeamSelection) => {
    const response = await cloudSession.runAction(
      {
        type: "advance-week",
        ...(matchSelection ? { matchSelection } : {}),
      },''',
    '''  const executeAdvanceWeek = async (
    matchSelection?: TeamSelection,
    matchTactics?: MatchTacticPlan,
  ) => {
    const response = await cloudSession.runAction(
      {
        type: "advance-week",
        ...(matchSelection ? { matchSelection } : {}),
        ...(matchTactics ? { matchTactics } : {}),
      },''',
)
replace_once(
    game_app,
    '''        ...(preparation.opponentSelection
          ? { opponentSelection: preparation.opponentSelection }
          : {}),
      });''',
    '''        ...(preparation.opponentSelection
          ? { opponentSelection: preparation.opponentSelection }
          : {}),
        ...(preparation.opponentTactics
          ? { opponentTactics: preparation.opponentTactics }
          : {}),
      });''',
)
replace_once(
    game_app,
    '''        onStart={(selection) => {
          if (preMatch.kind === "pvp") {
            const opponentSnapshotId = preMatch.opponentSnapshotId;
            void (async () => {
              await challengePvpTeam(opponentSnapshotId, selection);
              setPreMatch(null);
            })();
            return;
          }
          void executeAdvanceWeek(selection);
        }}''',
    '''        onStart={(selection, tactics) => {
          if (preMatch.kind === "pvp") {
            const opponentSnapshotId = preMatch.opponentSnapshotId;
            void (async () => {
              await challengePvpTeam(opponentSnapshotId, selection, tactics);
              setPreMatch(null);
            })();
            return;
          }
          void executeAdvanceWeek(selection, tactics);
        }}''',
)
replace_once(
    game_app,
    '''        {...(preMatch.kind === "week" && preMatch.opponentSelection
          ? { opponentSelection: preMatch.opponentSelection }
          : {})}
        pending={preMatchPending}''',
    '''        {...(preMatch.kind === "week" && preMatch.opponentSelection
          ? { opponentSelection: preMatch.opponentSelection }
          : {})}
        {...(preMatch.opponentTactics
          ? { opponentTactics: preMatch.opponentTactics }
          : {})}
        pending={preMatchPending}''',
)
replace_once(
    game_app,
    '''            opponentName: selectedOpponent.schoolName,
            opponentStrength: selectedOpponent.teamPower,
          });''',
    '''            opponentName: selectedOpponent.schoolName,
            opponentStrength: selectedOpponent.teamPower,
            ...(selectedOpponent.tactics
              ? { opponentTactics: selectedOpponent.tactics }
              : {}),
          });''',
)

pvp_screen = "src/features/pvp/PvpScreen.tsx"
replace_once(
    pvp_screen,
    '''} from "../../domain/pvp/pvpContracts";
import "./pvp.css";''',
    '''} from "../../domain/pvp/pvpContracts";
import { tacticOptionLabel } from "../team/tacticsPresentation";
import "./pvp.css";''',
)
replace_once(
    pvp_screen,
    '''      <div className="pvp-opponent-card__record">''',
    '''      <div
        aria-label={`戦術傾向 ${opponent.schoolName}`}
        className="pvp-opponent-card__tactics"
      >
        {opponent.tactics ? (
          <>
            <span>
              サーブ {tacticOptionLabel("serve", opponent.tactics.serve)}
            </span>
            <span>
              攻撃 {tacticOptionLabel("attack", opponent.tactics.attack)}
            </span>
            <span>
              ブロック {tacticOptionLabel("block", opponent.tactics.block)}
            </span>
          </>
        ) : (
          <strong>戦術傾向 非公開</strong>
        )}
      </div>
      <div className="pvp-opponent-card__record">''',
)

pvp_css = "src/features/pvp/pvp.css"
replace_once(
    pvp_css,
    '''.pvp-opponent-card__record {
  margin-top: 10px;''',
    '''.pvp-opponent-card__tactics {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
}

.pvp-opponent-card__tactics span,
.pvp-opponent-card__tactics strong {
  border-radius: 999px;
  background: #e7f1f3;
  padding: 5px 8px;
  color: #285a63;
  font-size: 0.62rem;
  font-weight: 800;
}

.pvp-opponent-card__tactics strong {
  background: #edf1f3;
  color: #687984;
}

.pvp-opponent-card__record {
  margin-top: 10px;''',
)
