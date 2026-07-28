import { fireEvent, render, screen } from "@testing-library/react";
import { BottomSheet } from "../../../src/ui/BottomSheet";

describe("BottomSheet", () => {
  it("closes with Escape", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet onClose={onClose} open title="選手を選択">
        <button type="button">選手A</button>
      </BottomSheet>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cycles keyboard focus inside the modal", () => {
    render(
      <BottomSheet onClose={() => undefined} open title="選手を選択">
        <button type="button">選手A</button>
        <button type="button">選手B</button>
      </BottomSheet>,
    );

    const close = screen.getByRole("dialog").querySelector<HTMLButtonElement>(
      ".ui-icon-button",
    )!;
    const firstChoice = screen.getByRole("button", { name: "選手A" });
    const lastChoice = screen.getByRole("button", { name: "選手B" });

    expect(close).toHaveFocus();
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastChoice).toHaveFocus();

    lastChoice.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    firstChoice.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(lastChoice).toHaveFocus();
  });
});
