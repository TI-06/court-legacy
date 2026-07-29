import { useEffect, useState, type ChangeEvent } from "react";
import type { GameState } from "../../domain/model/GameState";
import {
  SAVE_SLOT_IDS,
  type GameRepository,
  type SaveSlotId,
  type SaveSlotSummary,
} from "../../persistence/GameRepository";
import {
  decodeGameState,
  encodeGameState,
} from "../../persistence/gameStateCodec";
import { BottomSheet } from "../../ui/BottomSheet";
import "../../ui/ui.css";
import "./save-sheet.css";

interface SaveSheetProps {
  open: boolean;
  state: GameState;
  activeSlotId: SaveSlotId;
  repository: GameRepository;
  onLoadState: (state: GameState) => void;
  onActiveSlotChange: (slotId: SaveSlotId) => void;
  onClose: () => void;
}

function emptySlots(): SaveSlotSummary[] {
  return SAVE_SLOT_IDS.map((slotId) => ({
    slotId,
    exists: false,
    updatedAt: null,
    schoolName: null,
    gameDate: null,
    yearIndex: null,
    backupCount: 0,
  }));
}

function slotLabel(slotId: SaveSlotId): string {
  return `スロット${Number(slotId.at(-1))}`;
}

function formatSavedAt(value: string | null): string {
  if (!value) {
    return "未保存";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("ファイルを読み取れません")),
    );
    reader.readAsText(file);
  });
}

export function SaveSheet({
  open,
  state,
  activeSlotId,
  repository,
  onLoadState,
  onActiveSlotChange,
  onClose,
}: SaveSheetProps) {
  const [slots, setSlots] = useState<SaveSlotSummary[]>(emptySlots);
  const [loading, setLoading] = useState(false);
  const [busySlotId, setBusySlotId] = useState<SaveSlotId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSlots = async () => {
    const nextSlots = await repository.listSlots();
    setSlots(nextSlots);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setLoading(true);
    setMessage(null);
    setError(null);
    repository
      .listSlots()
      .then((nextSlots) => {
        if (active) {
          setSlots(nextSlots);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "セーブ情報を取得できません",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, repository]);

  const saveSlot = async (slotId: SaveSlotId) => {
    setBusySlotId(slotId);
    setMessage(null);
    setError(null);
    try {
      await repository.save(slotId, state, "manual");
      onActiveSlotChange(slotId);
      await refreshSlots();
      setMessage(`${slotLabel(slotId)}へ保存しました`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存に失敗しました");
    } finally {
      setBusySlotId(null);
    }
  };

  const loadSlot = async (slotId: SaveSlotId) => {
    setBusySlotId(slotId);
    setMessage(null);
    setError(null);
    try {
      const loadedState = await repository.load(slotId);
      onLoadState(loadedState);
      onActiveSlotChange(slotId);
      setMessage(`${slotLabel(slotId)}を読み込みました`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "読込に失敗しました");
    } finally {
      setBusySlotId(null);
    }
  };

  const deleteSlot = async (slotId: SaveSlotId) => {
    setBusySlotId(slotId);
    setMessage(null);
    setError(null);
    try {
      await repository.delete(slotId);
      await refreshSlots();
      setMessage(`${slotLabel(slotId)}を削除しました`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "削除に失敗しました");
    } finally {
      setBusySlotId(null);
    }
  };

  const exportState = () => {
    setMessage(null);
    setError(null);
    try {
      const serialized = encodeGameState(state);
      const blob = new Blob([serialized], { type: "application/json" });
      const createObjectUrl = URL.createObjectURL?.bind(URL);
      if (!createObjectUrl) {
        throw new Error("このブラウザではエクスポートできません");
      }
      const url = createObjectUrl(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `court-legacy-${state.date}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("現在のデータをエクスポートしました");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "エクスポートに失敗しました",
      );
    }
  };

  const importState = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setBusySlotId(activeSlotId);
    setMessage(null);
    setError(null);
    try {
      const importedState = decodeGameState(await readFileText(file));
      await repository.save(activeSlotId, importedState, "import");
      onLoadState(importedState);
      await refreshSlots();
      setMessage(`${slotLabel(activeSlotId)}へインポートしました`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "インポートに失敗しました",
      );
    } finally {
      setBusySlotId(null);
    }
  };

  return (
    <BottomSheet
      description="3つのスロットとJSONファイルで進行状況を管理します。"
      onClose={onClose}
      open={open}
      title="セーブ・ロード"
    >
      <div className="save-sheet-body">
        {loading ? (
          <p className="save-sheet-status">セーブ情報を確認中です</p>
        ) : null}
        {error ? (
          <p
            className="save-sheet-feedback save-sheet-feedback--error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="save-sheet-feedback" role="status">
            {message}
          </p>
        ) : null}

        <div className="save-slot-list">
          {slots.map((slot) => {
            const label = slotLabel(slot.slotId);
            const busy = busySlotId === slot.slotId;
            return (
              <article className="save-slot-card" key={slot.slotId}>
                <header className="save-slot-card__header">
                  <div>
                    <div className="save-slot-card__title">
                      <h3>{label}</h3>
                      {activeSlotId === slot.slotId ? (
                        <span>使用中</span>
                      ) : null}
                    </div>
                    <p>
                      {slot.exists
                        ? formatSavedAt(slot.updatedAt)
                        : "空きスロット"}
                    </p>
                  </div>
                  <strong>{slot.schoolName ?? "---"}</strong>
                </header>

                <div className="save-slot-card__meta">
                  <span>{slot.gameDate ?? "日付なし"}</span>
                  <span>
                    {slot.yearIndex === null
                      ? "年度なし"
                      : `${slot.yearIndex}年目`}
                  </span>
                  <span>バックアップ {slot.backupCount}件</span>
                </div>

                <div className="save-slot-card__actions">
                  <button
                    aria-label={`${label}に保存`}
                    disabled={busy}
                    onClick={() => void saveSlot(slot.slotId)}
                    type="button"
                  >
                    保存
                  </button>
                  <button
                    aria-label={`${label}を読込`}
                    disabled={!slot.exists || busy}
                    onClick={() => void loadSlot(slot.slotId)}
                    type="button"
                  >
                    読込
                  </button>
                  <button
                    aria-label={`${label}を削除`}
                    className="save-slot-card__delete"
                    disabled={!slot.exists || busy}
                    onClick={() => void deleteSlot(slot.slotId)}
                    type="button"
                  >
                    削除
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <section className="save-transfer-panel" aria-label="ファイル転送">
          <div>
            <h3>JSONバックアップ</h3>
            <p>端末外へ保管したり、別ブラウザへ移行できます。</p>
          </div>
          <button onClick={exportState} type="button">
            現在のデータをエクスポート
          </button>
          <label className="save-import-label">
            JSONファイルをインポート
            <input
              accept="application/json,.json"
              aria-label="JSONファイルをインポート"
              onChange={(event) => void importState(event)}
              type="file"
            />
          </label>
          <p className="save-transfer-note">
            インポートは内容を検証してから、使用中スロットへ保存します。
          </p>
        </section>
      </div>
    </BottomSheet>
  );
}
