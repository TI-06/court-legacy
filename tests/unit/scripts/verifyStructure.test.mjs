import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { collectStructureErrors } from "../../../scripts/verifyStructure.mjs";

const temporaryRoots = [];

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), "court-legacy-verify-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("collectStructureErrors", () => {
  test("reports missing required paths and obsolete files or source markers", async () => {
    const root = await createRoot();
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "legacy-dir"), { recursive: true });
    await writeFile(
      join(root, "src", "screen.ts"),
      'export const marker = "OLD_ARCH";\n',
    );

    const errors = await collectStructureErrors({
      root,
      requiredPaths: ["required.txt"],
      forbiddenPaths: ["legacy-dir"],
      forbiddenPatterns: ["OLD_ARCH"],
      scanRoots: ["src"],
    });

    expect(errors).toEqual([
      "Missing required path: required.txt",
      "Forbidden path exists: legacy-dir",
      'Forbidden pattern "OLD_ARCH" found in src/screen.ts',
    ]);
  });

  test("returns no errors when the required structure is clean", async () => {
    const root = await createRoot();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "required.txt"), "present\n");
    await writeFile(
      join(root, "src", "screen.ts"),
      "export const ready = true;\n",
    );

    const errors = await collectStructureErrors({
      root,
      requiredPaths: ["required.txt"],
      forbiddenPaths: ["legacy-dir"],
      forbiddenPatterns: ["OLD_ARCH"],
      scanRoots: ["src"],
    });

    expect(errors).toEqual([]);
  });
});
