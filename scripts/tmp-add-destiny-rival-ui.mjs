import { readFileSync, writeFileSync } from "node:fs";

const path = "src/features/school/SchoolScreen.tsx";
let source = readFileSync(path, "utf8");

const importAnchor =
  'import type { SchoolReputation } from "../../domain/model/School";\n';
const importLine =
  'import { rivalryKey } from "../../domain/world/rivalWorldProgression";\n';
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) {
    throw new Error("SchoolScreen import anchor not found");
  }
  source = source.replace(importAnchor, importAnchor + importLine);
}

const stateAnchor = `  const graduates = state.history.graduates.filter(
    (graduate) => graduate.schoolId === school.id,
  );
`;
const stateAddition = `  const destinyRivalId = state.world.destinyRivalSchoolId;
  const destinyRival = destinyRivalId
    ? state.schools[destinyRivalId]
    : undefined;
  const destinyRivalScore = destinyRival
    ? (state.world.rivalryScores[rivalryKey(school.id, destinyRival.id)] ?? 0)
    : 0;
`;
if (!source.includes("const destinyRivalScore")) {
  if (!source.includes(stateAnchor)) {
    throw new Error("SchoolScreen state anchor not found");
  }
  source = source.replace(stateAnchor, stateAddition + stateAnchor);
}

const summaryAnchor = `          <span>
            通算シーズン<strong>{school.history.seasons}</strong>
          </span>
`;
const summaryReplacement = `          {destinyRival ? (
            <span>
              宿命校
              <strong>
                {destinyRival.name}・因縁 {destinyRivalScore}
              </strong>
            </span>
          ) : null}
${summaryAnchor}`;
if (!source.includes("{destinyRival.name}・因縁")) {
  if (!source.includes(summaryAnchor)) {
    throw new Error("SchoolScreen summary anchor not found");
  }
  source = source.replace(summaryAnchor, summaryReplacement);
}

writeFileSync(path, source);
