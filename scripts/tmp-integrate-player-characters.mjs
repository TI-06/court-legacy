import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`${label} anchor not found`);
  }
  return source.replace(before, after);
}

const uiCssPath = "src/ui/ui.css";
let uiCss = readFileSync(uiCssPath, "utf8");
uiCss = replaceRequired(
  uiCss,
  `.ui-player-tile {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 76px;
`,
  `.ui-player-tile {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 84px;
`,
  "player tile height",
);
uiCss = replaceRequired(
  uiCss,
  `.ui-player-tile--compact {
  min-width: 150px;
  min-height: 72px;
}

.ui-player-avatar {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 900;
  background: linear-gradient(145deg, #1a5364, #2a8791);
  border-radius: 14px;
  place-items: center;
}
`,
  `.ui-player-tile--compact {
  min-width: 150px;
  min-height: 80px;
}

.ui-player-avatar {
  position: relative;
  display: grid;
  width: 48px;
  height: 62px;
  flex: 0 0 auto;
  overflow: hidden;
  background: linear-gradient(160deg, #edf5f6, #dbe9ec);
  border: 1px solid #d3e0e4;
  border-radius: 15px;
  box-shadow: inset 0 -8px 18px rgb(30 83 96 / 8%);
  place-items: center;
}

.ui-player-character {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 3px 2px rgb(22 45 55 / 16%));
}

.ui-player-character--prospect {
  filter: drop-shadow(0 3px 3px rgb(190 129 25 / 24%));
}

.ui-player-character--generational {
  filter: drop-shadow(0 4px 5px rgb(190 129 25 / 34%));
}
`,
  "player avatar",
);
writeFileSync(uiCssPath, uiCss);

const mobilePath = "src/mobile-layout.css";
let mobile = readFileSync(mobilePath, "utf8");
mobile = mobile
  .replace(
    `.court-slot .ui-player-avatar {
  width: 34px;
  height: 34px;
  border-radius: 11px;
}`,
    `.court-slot .ui-player-avatar {
  width: 34px;
  height: 46px;
  border-radius: 11px;
}`,
  )
  .replace(
    `.bench-rail .ui-player-avatar {
  width: 38px;
  height: 38px;
}`,
    `.bench-rail .ui-player-avatar {
  width: 38px;
  height: 50px;
}`,
  )
  .replace(
    `.court-slot .ui-player-avatar {
    width: 30px;
    height: 30px;
  }`,
    `.court-slot .ui-player-avatar {
    width: 30px;
    height: 42px;
  }`,
  );
writeFileSync(mobilePath, mobile);

const teamCssPath = "src/features/team/team-direct.css";
let teamCss = readFileSync(teamCssPath, "utf8");
teamCss = replaceRequired(
  teamCss,
  `.court-slot .ui-player-avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}`,
  `.court-slot .ui-player-avatar {
  width: 38px;
  height: 50px;
  border-radius: 12px;
}`,
  "team avatar",
);
writeFileSync(teamCssPath, teamCss);

for (const path of [
  "src/features/team/TeamScreen.tsx",
  "src/features/training/TrainingScreen.tsx",
]) {
  let source = readFileSync(path, "utf8");
  source = source.replace(
    /<PlayerTile\n(?!\s*uniform=)/g,
    `<PlayerTile\n                uniform={school.uniform}\n`,
  );
  writeFileSync(path, source);
}
