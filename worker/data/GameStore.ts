import type { GameState } from "../../src/domain/model/GameState";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";

export interface CloudGameSnapshot {
  userId: string;
  schoolDbId: string;
  revision: number;
  state: GameState;
  teamSelection: TeamSelection;
}

export interface CreateCloudGameInput {
  userId: string;
  displayName: string;
  schoolName: string;
  schoolShortName: string;
  coachName: string;
  regionId: string;
  state: GameState;
  teamSelection: TeamSelection;
}

export interface PersistOperationInput {
  userId: string;
  operationId: string;
  expectedRevision: number;
  state: GameState;
  teamSelection: TeamSelection;
  response: Record<string, unknown>;
}

export interface GameStore {
  getSnapshot(userId: string): Promise<CloudGameSnapshot | null>;
  createGame(input: CreateCloudGameInput): Promise<CloudGameSnapshot>;
  applyOperation(input: PersistOperationInput): Promise<CloudGameSnapshot>;
}

export class GameAlreadyExistsError extends Error {
  constructor() {
    super("game already exists");
    this.name = "GameAlreadyExistsError";
  }
}

export class GameStoreDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GameStoreDataError";
  }
}
