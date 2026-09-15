from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, got {count}: {old!r}")
    target.write_text(text.replace(old, new, 1))


Path("src/domain/relationships/relationshipPresentation.ts").write_text(
    '''import { relationshipKey, type GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import type { SpecialRelationshipKind } from "./relationshipTypes";

export type RelationshipLabel = "犬猿" | "不仲" | "普通" | "好相性" | "親友";

export interface PlayerRelationshipPresentation {
  playerId: PlayerId;
  displayName: string;
  score: number;
  label: RelationshipLabel;
  specialKinds: SpecialRelationshipKind[];
  mentorDirection: "mentor" | "protege" | null;
}

const specialRelationshipLabels: Record<SpecialRelationshipKind, string> = {
  rival: "ライバル",
  mentor: "師弟",
  partner: "相棒",
};

export function relationshipLabel(score: number): RelationshipLabel {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped < 20) return "犬猿";
  if (clamped < 40) return "不仲";
  if (clamped < 60) return "普通";
  if (clamped < 80) return "好相性";
  return "親友";
}

export function specialRelationshipKindLabel(
  kind: SpecialRelationshipKind,
): string {
  return specialRelationshipLabels[kind];
}

export function selectPlayerRelationships(
  state: GameState,
  playerId: PlayerId,
): PlayerRelationshipPresentation[] {
  const school = Object.values(state.schools).find((candidate) =>
    candidate.playerIds.includes(playerId),
  );
  if (!school) return [];

  return school.playerIds
    .filter((teammateId) => teammateId !== playerId)
    .map((teammateId) => {
      const teammate = state.players[teammateId];
      if (!teammate) return null;
      const key = relationshipKey(playerId, teammateId);
      const score = Math.max(
        0,
        Math.min(100, state.playerRelationships[key] ?? 50),
      );
      const bond = state.playerRelationshipBonds[key];
      const specialKinds = bond?.tags.map((tag) => tag.kind) ?? [];
      const mentorTag = bond?.tags.find((tag) => tag.kind === "mentor");
      const mentorDirection = mentorTag
        ? mentorTag.mentorPlayerId === playerId
          ? "mentor"
          : mentorTag.protegePlayerId === playerId
            ? "protege"
            : null
        : null;

      return {
        playerId: teammateId,
        displayName: `${teammate.lastName} ${teammate.firstName}`,
        score,
        label: relationshipLabel(score),
        specialKinds,
        mentorDirection,
      } satisfies PlayerRelationshipPresentation;
    })
    .filter(
      (row): row is PlayerRelationshipPresentation => row !== null,
    )
    .sort((left, right) => {
      const leftTagged = left.specialKinds.length > 0;
      const rightTagged = right.specialKinds.length > 0;
      if (leftTagged !== rightTagged) return leftTagged ? -1 : 1;

      const distanceDifference =
        Math.abs(right.score - 50) - Math.abs(left.score - 50);
      if (distanceDifference !== 0) return distanceDifference;
      return left.playerId.localeCompare(right.playerId);
    });
}
'''
)

player_hub = "src/features/team/PlayerHubScreen.tsx"
replace_once(
    player_hub,
    'import type { PlayerId } from "../../domain/model/identifiers";\n',
    'import type { PlayerId } from "../../domain/model/identifiers";\nimport {\n  selectPlayerRelationships,\n  specialRelationshipKindLabel,\n} from "../../domain/relationships/relationshipPresentation";\n',
)
replace_once(
    player_hub,
    '''    const growth = summarizePlayerGrowth(state, selectedPlayer.id);\n    const maxTrendGrowth = Math.max(\n''',
    '''    const growth = summarizePlayerGrowth(state, selectedPlayer.id);\n    const relationships = selectPlayerRelationships(state, selectedPlayer.id);\n    const maxTrendGrowth = Math.max(\n''',
)
replace_once(
    player_hub,
    '''        ) : null}\n\n        <section\n          className="player-detail__growth-summary"\n''',
    '''        ) : null}\n\n        <section className="player-detail__relationships" aria-label="人間関係">\n          <div className="player-detail__relationships-heading">\n            <h3>人間関係</h3>\n            <span>{relationships.length}人</span>\n          </div>\n          <div className="player-detail__relationship-list">\n            {relationships.map((relationship) => (\n              <article\n                className="player-detail__relationship-row"\n                key={relationship.playerId}\n              >\n                <div className="player-detail__relationship-copy">\n                  <strong>{relationship.displayName}</strong>\n                  <small>{relationship.label}</small>\n                </div>\n                {relationship.specialKinds.length > 0 ? (\n                  <div\n                    className="player-detail__relationship-tags"\n                    aria-label="特殊関係"\n                  >\n                    {relationship.specialKinds.map((kind) => (\n                      <span key={kind}>\n                        {specialRelationshipKindLabel(kind)}\n                      </span>\n                    ))}\n                    {relationship.mentorDirection ? (\n                      <small>\n                        {relationship.mentorDirection === "mentor"\n                          ? "教える側"\n                          : "教わる側"}\n                      </small>\n                    ) : null}\n                  </div>\n                ) : null}\n                <span\n                  aria-label={`関係値 ${relationship.score}`}\n                  aria-valuemax={100}\n                  aria-valuemin={0}\n                  aria-valuenow={relationship.score}\n                  className="player-detail__relationship-meter"\n                  role="meter"\n                >\n                  <span\n                    className="player-detail__relationship-meter-fill"\n                    style={{ width: `${relationship.score}%` }}\n                  />\n                </span>\n              </article>\n            ))}\n          </div>\n        </section>\n\n        <section\n          className="player-detail__growth-summary"\n''',
)

fullscreen = "src/features/home/FullscreenEventExperience.tsx"
replace_once(
    fullscreen,
    'import type { GameState } from "../../domain/model/GameState";\n',
    'import { relationshipKey, type GameState } from "../../domain/model/GameState";\nimport {\n  relationshipLabel,\n  specialRelationshipKindLabel,\n} from "../../domain/relationships/relationshipPresentation";\nimport { getRelationshipBond } from "../../domain/relationships/specialRelationships";\n',
)
replace_once(
    fullscreen,
    '''  const choices = event.choices.filter((choice) =>\n    pending.choiceIds.includes(choice.id),\n  );\n\n  const choose = async (choiceId: string) => {\n''',
    '''  const choices = event.choices.filter((choice) =>\n    pending.choiceIds.includes(choice.id),\n  );\n  const pairRelationship = (() => {\n    if (pending.actorPlayerIds.length !== 2) return null;\n    const [leftId, rightId] = pending.actorPlayerIds;\n    if (!leftId || !rightId) return null;\n    const score = Math.max(\n      0,\n      Math.min(\n        100,\n        state.playerRelationships[relationshipKey(leftId, rightId)] ?? 50,\n      ),\n    );\n    const bond = getRelationshipBond(state, leftId, rightId);\n    return {\n      score,\n      label: relationshipLabel(score),\n      specialKinds: bond?.tags.map((tag) => tag.kind) ?? [],\n    };\n  })();\n\n  const choose = async (choiceId: string) => {\n''',
)
replace_once(
    fullscreen,
    '''          </div>\n          <p className="event-story">\n            {renderEventText(event.bodyTemplate, state, pending.actorPlayerIds)}\n          </p>\n''',
    '''          </div>\n          {pairRelationship ? (\n            <section\n              aria-label="選手間の関係"\n              className="event-relationship"\n            >\n              <div className="event-relationship__summary">\n                <span>現在の関係</span>\n                <strong>{pairRelationship.label}</strong>\n              </div>\n              {pairRelationship.specialKinds.length > 0 ? (\n                <div className="event-relationship__tags">\n                  {pairRelationship.specialKinds.map((kind) => (\n                    <span key={kind}>{specialRelationshipKindLabel(kind)}</span>\n                  ))}\n                </div>\n              ) : null}\n              <span\n                aria-label={`関係値 ${pairRelationship.score}`}\n                aria-valuemax={100}\n                aria-valuemin={0}\n                aria-valuenow={pairRelationship.score}\n                className="event-relationship__meter"\n                role="meter"\n              >\n                <span\n                  className="event-relationship__meter-fill"\n                  style={{ width: `${pairRelationship.score}%` }}\n                />\n              </span>\n            </section>\n          ) : null}\n          <p className="event-story">\n            {renderEventText(event.bodyTemplate, state, pending.actorPlayerIds)}\n          </p>\n''',
)

player_css = Path("src/features/team/player-hub.css")
player_css.write_text(
    player_css.read_text()
    + '''\n\n.player-detail__relationships {\n  display: grid;\n  min-width: 0;\n  padding: 10px 11px;\n  gap: 8px;\n  background:\n    linear-gradient(135deg, rgb(46 139 216 / 8%), transparent 58%),\n    rgb(11 26 45 / 92%);\n  border: 1px solid rgb(255 255 255 / 10%);\n  border-radius: 12px;\n}\n\n.player-detail__relationships-heading {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.player-detail__relationships-heading h3 {\n  margin: 0;\n  font-size: 13px;\n}\n\n.player-detail__relationships-heading > span {\n  color: var(--game-text-muted, #a9b8ca);\n  font-size: 10px;\n  font-weight: 800;\n}\n\n.player-detail__relationship-list {\n  display: grid;\n  gap: 6px;\n}\n\n.player-detail__relationship-row {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  align-items: center;\n  min-width: 0;\n  padding: 8px 9px;\n  gap: 6px 9px;\n  background: rgb(16 41 69 / 58%);\n  border: 1px solid rgb(255 255 255 / 7%);\n  border-radius: 10px;\n}\n\n.player-detail__relationship-copy {\n  display: grid;\n  min-width: 0;\n  gap: 2px;\n}\n\n.player-detail__relationship-copy strong {\n  overflow: hidden;\n  font-size: 12px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.player-detail__relationship-copy small {\n  color: #d8e8f7;\n  font-size: 10px;\n  font-weight: 900;\n}\n\n.player-detail__relationship-tags {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: flex-end;\n  gap: 4px;\n}\n\n.player-detail__relationship-tags span,\n.player-detail__relationship-tags small {\n  padding: 2px 6px;\n  font-size: 9px;\n  font-weight: 900;\n  border-radius: 999px;\n}\n\n.player-detail__relationship-tags span {\n  color: #ffd99a;\n  background: rgb(244 122 24 / 14%);\n  border: 1px solid rgb(244 122 24 / 26%);\n}\n\n.player-detail__relationship-tags small {\n  color: #bfe7ff;\n  background: rgb(46 139 216 / 12%);\n  border: 1px solid rgb(116 216 255 / 18%);\n}\n\n.player-detail__relationship-meter {\n  grid-column: 1 / -1;\n  display: block;\n  height: 5px;\n  overflow: hidden;\n  background: rgb(255 255 255 / 8%);\n  border-radius: 999px;\n}\n\n.player-detail__relationship-meter-fill {\n  display: block;\n  height: 100%;\n  background: linear-gradient(90deg, #2e8bd8, #f47a18);\n  border-radius: inherit;\n}\n'''
)

fullscreen_css = Path("src/features/home/fullscreen-event.css")
fullscreen_css.write_text(
    fullscreen_css.read_text()
    + '''\n\n.fullscreen-event .event-relationship {\n  display: grid;\n  padding: 10px 12px;\n  gap: 7px;\n  background: linear-gradient(135deg, rgb(46 139 216 / 12%), rgb(16 41 69 / 74%));\n  border: 1px solid rgb(116 216 255 / 16%);\n  border-radius: 12px;\n}\n\n.event-relationship__summary {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.event-relationship__summary span {\n  color: var(--game-text-muted, #a9b8ca);\n  font-size: 0.68rem;\n  font-weight: 800;\n}\n\n.event-relationship__summary strong {\n  color: #eef9ff;\n  font-size: 0.82rem;\n}\n\n.event-relationship__tags {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 5px;\n}\n\n.event-relationship__tags span {\n  padding: 3px 7px;\n  color: #ffd99a;\n  font-size: 0.64rem;\n  font-weight: 900;\n  background: rgb(244 122 24 / 14%);\n  border: 1px solid rgb(244 122 24 / 26%);\n  border-radius: 999px;\n}\n\n.event-relationship__meter {\n  display: block;\n  height: 6px;\n  overflow: hidden;\n  background: rgb(255 255 255 / 8%);\n  border-radius: 999px;\n}\n\n.event-relationship__meter-fill {\n  display: block;\n  height: 100%;\n  background: linear-gradient(90deg, #2e8bd8, #f47a18);\n  border-radius: inherit;\n}\n'''
)
