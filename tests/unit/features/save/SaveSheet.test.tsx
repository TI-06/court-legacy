import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { SaveSheet } from "../../../../src/features/save/SaveSheet";
import type {
  GameRepository,
  SaveSlotSummary,
} from "../../../../src/persistence/GameRepository";

function createSlots(): SaveSlotSummary[] {
  return [
    {
      slotId: "slot-1",
      exists: true,
      updatedAt: "2026-07-29T05:00:00.000Z",
      schoolName: "蒼波高校",
      gameDate: "2026-04-08",
      yearIndex: 1,
      backupCount: 2,
    },
    {
      slotId: "slot-2",
      exists: false,
      updatedAt: null,
      schoolName: null,
      gameDate: null,
      yearIndex: null,
      backupCount: 0,
    },
    {
      slotId: "slot-3",
      exists: false,
      updatedAt: null,
      schoolName: null,
      gameDate: null,
      yearIndex: null,
      backupCount: 0,
    },
  ];
}

function createRepository(
  overrides: Partial<GameRepository> = {},
): GameRepository {
  return {
    listSlots: vi.fn().mockResolvedValue(createSlots()),
    load: vi.fn().mockResolvedValue(createDemoGame()),
    save: vi.fn().mockResolvedValue(undefined),
    createBackup: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("save sheet", () => {
  it("shows three slots and marks the active slot", async () => {
    const repository = createRepository();

    render(
      <SaveSheet
        activeSlotId="slot-1"
        onActiveSlotChange={vi.fn()}
        onClose={vi.fn()}
        onLoadState={vi.fn()}
        open
        repository={repository}
        state={createDemoGame()}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "セーブ・ロード" }),
    ).toBeVisible();
    expect(await screen.findByText("スロット1")).toBeVisible();
    expect(screen.getByText("スロット2")).toBeVisible();
    expect(screen.getByText("スロット3")).toBeVisible();
    expect(screen.getByText("使用中")).toBeVisible();
    expect(screen.getByText("バックアップ 2件")).toBeVisible();
  });

  it("saves the current state into the selected slot", async () => {
    const repository = createRepository();
    const state = createDemoGame();

    render(
      <SaveSheet
        activeSlotId="slot-1"
        onActiveSlotChange={vi.fn()}
        onClose={vi.fn()}
        onLoadState={vi.fn()}
        open
        repository={repository}
        state={state}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "スロット1に保存" }),
    );

    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith("slot-1", state, "manual"),
    );
    expect(await screen.findByText("スロット1へ保存しました")).toBeVisible();
  });

  it("loads a valid slot and changes the active slot", async () => {
    const loaded = createDemoGame();
    loaded.date = "2026-05-06";
    const repository = createRepository({
      load: vi.fn().mockResolvedValue(loaded),
    });
    const onLoadState = vi.fn();
    const onActiveSlotChange = vi.fn();

    render(
      <SaveSheet
        activeSlotId="slot-2"
        onActiveSlotChange={onActiveSlotChange}
        onClose={vi.fn()}
        onLoadState={onLoadState}
        open
        repository={repository}
        state={createDemoGame()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "スロット1を読込" }),
    );

    await waitFor(() => expect(onLoadState).toHaveBeenCalledWith(loaded));
    expect(onActiveSlotChange).toHaveBeenCalledWith("slot-1");
  });

  it("does not overwrite a slot when imported JSON is invalid", async () => {
    const repository = createRepository();

    render(
      <SaveSheet
        activeSlotId="slot-1"
        onActiveSlotChange={vi.fn()}
        onClose={vi.fn()}
        onLoadState={vi.fn()}
        open
        repository={repository}
        state={createDemoGame()}
      />,
    );

    const input = await screen.findByLabelText("JSONファイルをインポート");
    fireEvent.change(input, {
      target: {
        files: [
          new File(["not-json"], "broken.json", { type: "application/json" }),
        ],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "セーブデータを読み取れません",
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
