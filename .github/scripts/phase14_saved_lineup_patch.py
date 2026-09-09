from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


team = "src/features/team/TeamScreen.tsx"
replace_once(
    team,
    'import { validateTeamSelection } from "../../domain/team/validateTeamSelection";\n',
    'import { selectSavedLineupSlots } from "../../domain/team/savedLineupSelectors";\n'
    'import type { SavedLineupSlot } from "../../domain/team/teamPlanningTypes";\n'
    'import { validateTeamSelection } from "../../domain/team/validateTeamSelection";\n',
)
replace_once(
    team,
    '''interface TeamScreenProps {
  state: GameState;
  selection: TeamSelection;
  onChange: (selection: TeamSelection) => void;
  pending?: boolean;
}''',
    '''interface TeamScreenProps {
  state: GameState;
  selection: TeamSelection;
  onChange: (selection: TeamSelection) => void;
  pending?: boolean;
  planningPending?: boolean;
  onSaveLineupPreset?: (
    slot: SavedLineupSlot,
    name: string,
    selection: TeamSelection,
  ) => void | Promise<void>;
  onDeleteLineupPreset?: (slot: SavedLineupSlot) => void | Promise<void>;
}''',
)
replace_once(
    team,
    '''export function TeamScreen({
  state,
  selection,
  onChange,
  pending = false,
}: TeamScreenProps) {
  const [replacements, setReplacements] = useState<StarterReplacement[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);''',
    '''export function TeamScreen({
  state,
  selection,
  onChange,
  pending = false,
  planningPending = false,
  onSaveLineupPreset,
  onDeleteLineupPreset,
}: TeamScreenProps) {
  const [replacements, setReplacements] = useState<StarterReplacement[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedLineupNames, setSavedLineupNames] = useState<
    Partial<Record<SavedLineupSlot, string>>
  >({});''',
)
replace_once(
    team,
    '''  const issues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection,
  });
  const lockedIds = new Set(selection.substitutionPolicy.starterLockPlayerIds);''',
    '''  const issues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection,
  });
  const savedLineupSlots = useMemo(() => selectSavedLineupSlots(state), [state]);
  const currentLineupValid = issues.length === 0;
  const lockedIds = new Set(selection.substitutionPolicy.starterLockPlayerIds);''',
)
replace_once(
    team,
    '''  const emitSelection = (next: TeamSelection) => {
    setReplacements([]);
    setActionError(null);
    onChange(next);
  };''',
    '''  const savedLineupName = (
    slot: SavedLineupSlot,
    presetName: string | null,
  ): string => savedLineupNames[slot] ?? presetName ?? "";

  const clearSavedLineupNameOverride = (slot: SavedLineupSlot) => {
    setSavedLineupNames((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  };

  const saveCurrentLineupToSlot = (
    slot: SavedLineupSlot,
    presetName: string | null,
  ) => {
    const name = savedLineupName(slot, presetName).trim();
    if (
      planningPending ||
      !currentLineupValid ||
      !name ||
      !onSaveLineupPreset
    ) {
      return;
    }
    const result = onSaveLineupPreset(slot, name, structuredClone(selection));
    if (result instanceof Promise) {
      void result.then(() => clearSavedLineupNameOverride(slot));
    } else {
      clearSavedLineupNameOverride(slot);
    }
  };

  const emitSelection = (next: TeamSelection) => {
    setReplacements([]);
    setActionError(null);
    onChange(next);
  };''',
)
replace_once(
    team,
    '''        <section
          className="team-panel team-policy-panel"
          aria-labelledby="policy-heading"
        >''',
    '''        <section
          className="team-panel saved-lineup-panel"
          aria-labelledby="saved-lineup-heading"
        >
          <div className="team-section-heading team-section-heading--compact">
            <div>
              <p className="section-kicker">3つまで登録</p>
              <h3 id="saved-lineup-heading">保存編成</h3>
            </div>
          </div>
          <div className="saved-lineup-grid">
            {savedLineupSlots.map((slotView) => {
              const name = savedLineupName(
                slotView.slot,
                slotView.preset?.name ?? null,
              );
              const saveDisabled =
                planningPending ||
                !currentLineupValid ||
                !name.trim() ||
                !onSaveLineupPreset;
              return (
                <article
                  className={`saved-lineup-card saved-lineup-card--${slotView.status}`}
                  data-testid={`saved-lineup-slot-${slotView.slot}`}
                  key={slotView.slot}
                >
                  <div className="saved-lineup-card__heading">
                    <strong>スロット{slotView.slot}</strong>
                    <span>
                      {slotView.status === "empty"
                        ? "未保存"
                        : slotView.status === "valid"
                          ? "使用可能"
                          : "再設定が必要"}
                    </span>
                  </div>
                  <input
                    aria-label={`保存編成名 スロット${slotView.slot}`}
                    disabled={planningPending}
                    maxLength={24}
                    onChange={(event) =>
                      setSavedLineupNames((current) => ({
                        ...current,
                        [slotView.slot]: event.currentTarget.value,
                      }))
                    }
                    placeholder={`スロット${slotView.slot}の名前`}
                    type="text"
                    value={name}
                  />
                  {slotView.status === "invalid" && slotView.issueMessage ? (
                    <p className="saved-lineup-card__issue">
                      {slotView.issueMessage}
                    </p>
                  ) : null}
                  <div className="saved-lineup-card__actions">
                    {slotView.status === "empty" ? (
                      <button
                        disabled={saveDisabled}
                        onClick={() =>
                          saveCurrentLineupToSlot(slotView.slot, null)
                        }
                        type="button"
                      >
                        現在の編成を保存
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={
                            planningPending || slotView.status !== "valid"
                          }
                          onClick={() => {
                            if (
                              slotView.status === "valid" &&
                              slotView.preset
                            ) {
                              onChange(
                                structuredClone(slotView.preset.selection),
                              );
                            }
                          }}
                          type="button"
                        >
                          適用
                        </button>
                        <button
                          disabled={saveDisabled}
                          onClick={() =>
                            saveCurrentLineupToSlot(
                              slotView.slot,
                              slotView.preset?.name ?? null,
                            )
                          }
                          type="button"
                        >
                          上書き保存
                        </button>
                        <button
                          disabled={planningPending || !onDeleteLineupPreset}
                          onClick={() => {
                            if (!onDeleteLineupPreset) return;
                            const result = onDeleteLineupPreset(slotView.slot);
                            if (result instanceof Promise) {
                              void result.then(() =>
                                clearSavedLineupNameOverride(slotView.slot),
                              );
                            } else {
                              clearSavedLineupNameOverride(slotView.slot);
                            }
                          }}
                          type="button"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className="team-panel team-policy-panel"
          aria-labelledby="policy-heading"
        >''',
)

hub = "src/features/team/PlayerHubScreen.tsx"
replace_once(
    hub,
    'import type { PlayerId } from "../../domain/model/identifiers";\n',
    'import type { PlayerId } from "../../domain/model/identifiers";\n'
    'import type { SavedLineupSlot } from "../../domain/team/teamPlanningTypes";\n',
)
replace_once(
    hub,
    '''  onSetDevelopmentPriorities?: (playerIds: PlayerId[]) => void | Promise<void>;
}''',
    '''  onSetDevelopmentPriorities?: (playerIds: PlayerId[]) => void | Promise<void>;
  onSaveLineupPreset?: (
    slot: SavedLineupSlot,
    name: string,
    selection: TeamSelection,
  ) => void | Promise<void>;
  onDeleteLineupPreset?: (slot: SavedLineupSlot) => void | Promise<void>;
}''',
)
replace_once(
    hub,
    '''  onChangeTraining,
  onSetDevelopmentPriorities,
}: PlayerHubScreenProps) {''',
    '''  onChangeTraining,
  onSetDevelopmentPriorities,
  onSaveLineupPreset,
  onDeleteLineupPreset,
}: PlayerHubScreenProps) {''',
)
replace_once(
    hub,
    '''        <TeamScreen onChange={onChange} selection={selection} state={state} />''',
    '''        <TeamScreen
          onChange={onChange}
          onDeleteLineupPreset={onDeleteLineupPreset}
          onSaveLineupPreset={onSaveLineupPreset}
          pending={planningPending}
          planningPending={planningPending}
          selection={selection}
          state={state}
        />''',
)

app = "src/app/GameApp.tsx"
replace_once(
    app,
    'import { autoSelectTeam } from "../domain/team/autoSelectTeam";\n',
    'import { autoSelectTeam } from "../domain/team/autoSelectTeam";\n'
    'import type { SavedLineupSlot } from "../domain/team/teamPlanningTypes";\n',
)
replace_once(
    app,
    '''  const acceptPracticeOffer = async () => {''',
    '''  const saveLineupPreset = async (
    slot: SavedLineupSlot,
    name: string,
    selection: TeamSelection,
  ) => {
    await cloudSession.runAction(
      { type: "save-lineup-preset", slot, name, selection },
      "保存編成を保存しています…",
    );
  };

  const deleteLineupPreset = async (slot: SavedLineupSlot) => {
    await cloudSession.runAction(
      { type: "delete-lineup-preset", slot },
      "保存編成を削除しています…",
    );
  };

  const acceptPracticeOffer = async () => {''',
)
replace_once(
    app,
    '''        onChangeTraining={changePlayerTraining}
        onSetDevelopmentPriorities={saveDevelopmentPriorities}''',
    '''        onChangeTraining={changePlayerTraining}
        onDeleteLineupPreset={deleteLineupPreset}
        onSaveLineupPreset={saveLineupPreset}
        onSetDevelopmentPriorities={saveDevelopmentPriorities}''',
)

css = Path("src/features/team/team-direct.css")
marker = "/* Phase14 saved lineup management */"
if marker not in css.read_text():
    css.write_text(
        css.read_text()
        + '''

/* Phase14 saved lineup management */
.saved-lineup-panel {
  min-width: 0;
}

.saved-lineup-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-width: 0;
  gap: 8px;
}

.saved-lineup-card {
  display: grid;
  min-width: 0;
  padding: 10px;
  gap: 7px;
  background: rgb(7 20 35 / 72%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 12px;
}

.saved-lineup-card--invalid {
  border-color: rgb(255 102 95 / 45%);
}

.saved-lineup-card__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 6px;
}

.saved-lineup-card__heading strong {
  font-size: 12px;
}

.saved-lineup-card__heading span {
  color: var(--game-text-muted, #a9b8ca);
  font-size: 10px;
  font-weight: 800;
}

.saved-lineup-card--valid .saved-lineup-card__heading span {
  color: #77d59a;
}

.saved-lineup-card--invalid .saved-lineup-card__heading span,
.saved-lineup-card__issue {
  color: #ff8c86;
}

.saved-lineup-card input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0 9px;
  color: var(--game-text, #f4f7fb);
  font: inherit;
  font-size: 12px;
  background: rgb(255 255 255 / 6%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 9px;
}

.saved-lineup-card__issue {
  margin: 0;
  font-size: 10px;
  line-height: 1.4;
}

.saved-lineup-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 0;
  gap: 6px;
}

.saved-lineup-card__actions button {
  min-width: 0;
  min-height: 38px;
  padding: 6px 8px;
  color: var(--game-text, #f4f7fb);
  font: inherit;
  font-size: 10px;
  font-weight: 900;
  background: rgb(31 120 171 / 20%);
  border: 1px solid rgb(116 216 255 / 25%);
  border-radius: 8px;
}

.saved-lineup-card__actions button:disabled {
  opacity: 0.45;
}

@media (max-width: 420px) {
  .saved-lineup-grid {
    grid-template-columns: 1fr;
  }
}
'''
    )
