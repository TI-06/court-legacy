import { access, readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(path) {
  if (!(await pathExists(path))) {
    return [];
  }

  const pathStat = await stat(path);
  if (pathStat.isFile()) {
    return [path];
  }

  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => collectFiles(resolve(path, entry.name))),
  );
  return nested.flat();
}

export async function collectStructureErrors({
  root,
  requiredPaths,
  forbiddenPaths,
  forbiddenPatterns,
  scanRoots,
}) {
  const errors = [];

  for (const path of requiredPaths) {
    if (!(await pathExists(resolve(root, path)))) {
      errors.push(`Missing required path: ${path}`);
    }
  }

  for (const path of forbiddenPaths) {
    if (await pathExists(resolve(root, path))) {
      errors.push(`Forbidden path exists: ${path}`);
    }
  }

  for (const scanRoot of scanRoots) {
    const files = await collectFiles(resolve(root, scanRoot));
    for (const file of files) {
      let content;
      try {
        content = await readFile(file, "utf8");
      } catch {
        continue;
      }

      for (const pattern of forbiddenPatterns) {
        if (content.includes(pattern)) {
          const displayPath = relative(root, file).replaceAll("\\", "/");
          errors.push(`Forbidden pattern "${pattern}" found in ${displayPath}`);
        }
      }
    }
  }

  return errors;
}

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

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

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const errors = await collectStructureErrors({
    root: repositoryRoot,
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
}
