import type { GameState } from "../../src/domain/model/GameState";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";

export interface CloudGameSnapshot {
  userId: string;
  schoolDbId: string;
  revision: number;
  state: GameState;
  teamSelection: TeamSelection;
}

export interface PersistedOperationResponse {
  game: CloudGameSnapshot;
  operationId: string;
  outcome?: unknown;
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
  response: PersistedOperationResponse;
}

export interface PersistOperationResult {
  response: PersistedOperationResponse;
  replayed: boolean;
}

export interface GameStore {
  getSnapshot(userId: string): Promise<CloudGameSnapshot | null>;
  getOperationResponse(
    userId: string,
    operationId: string,
  ): Promise<PersistedOperationResponse | null>;
  createGame(input: CreateCloudGameInput): Promise<CloudGameSnapshot>;
  applyOperation(input: PersistOperationInput): Promise<PersistOperationResult>;
}

export class GameAlreadyExistsError extends Error {
  constructor() {
    super("game already exists");
    this.name = "GameAlreadyExistsError";
  }
}

export class RevisionConflictError extends Error {
  constructor() {
    super("revision conflict");
    this.name = "RevisionConflictError";
  }
}

export class GameStoreDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GameStoreDataError";
  }
}
