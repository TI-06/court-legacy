import type { Player } from "../../src/domain/model/Player";
import type { School } from "../../src/domain/model/School";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";

export interface PublishedPvpTeamSnapshot {
  id: string;
  userId: string;
  sourceRevision: number;
  sourceAcademicYear: number;
  sourceYearIndex: number;
  school: School;
  players: Record<string, Player>;
  teamSelection: TeamSelection;
  isActive: boolean;
  publishedAt: string;
}
