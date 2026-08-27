import { resolve } from "node:path";

import { collectStructureErrors } from "./verifyStructure.mjs";

const requiredPaths = [
  "src/app/AppBootstrap.tsx",
  "src/app/GameApp.tsx",
  "src/app/useGameSession.ts",
  "src/persistence/RecoveryCache.ts",
  "src/services/api/GameApiClient.ts",
  "src/services/auth/SupabaseAuthClient.ts",
  "worker/index.ts",
  "worker/router.ts",
  "worker/auth/verifyAccessToken.ts",
  "worker/game/applyGameAction.ts",
  "supabase/migrations/202608260001_v2_foundation.sql",
  "supabase/migrations/202608260002_game_operations.sql",
  "tests/e2e/v2-auth-game-flow.spec.ts",
  "tests/e2e/v2-operation-feedback.spec.ts",
];

const forbiddenPaths = [
  ".dev.vars",
  ".env",
  ".env.local",
  ".env.production",
  "src/features/save",
  "src/ui/player-art",
  "src/persistence/GameStateRepository.ts",
  "src/persistence/backupRotation.ts",
];

const forbiddenPatterns = [
  "SUPABASE_SECRET_KEY",
  "sb_secret_",
  "SaveSheet",
  "GameStateRepository",
  "backupRotation",
  "appearanceSeed",
  "player-art",
];

const errors = await collectStructureErrors({
  root: resolve(process.cwd()),
  requiredPaths,
  forbiddenPaths,
  forbiddenPatterns,
  scanRoots: ["src"],
});

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[V2 STRUCTURE] ${error}`);
  }
  process.exit(1);
}

console.log("[OK] V2 structure and client-secret guard");
