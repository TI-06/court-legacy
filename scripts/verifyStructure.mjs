import { access, readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

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
