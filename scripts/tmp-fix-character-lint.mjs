import { readFileSync, writeFileSync } from "node:fs";

const path = "src/ui/PlayerCharacter.tsx";
let source = readFileSync(path, "utf8");
source = source.replace(
  "export const DEFAULT_CHARACTER_UNIFORM: UniformColors = {",
  "const DEFAULT_CHARACTER_UNIFORM: UniformColors = {",
);
source = source.replace('<path d="M40 25H40" />', '<path d="M39 25H41" />');
writeFileSync(path, source);
