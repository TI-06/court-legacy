import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SchoolSetupScreen } from "../../../../src/features/onboarding/SchoolSetupScreen";

function fillForm() {
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "  たく監督  " },
  });
  fireEvent.change(screen.getByLabelText("学校名"), {
    target: { value: "  青葉高校  " },
  });
  fireEvent.change(screen.getByLabelText("略称"), {
    target: { value: "  青葉  " },
  });
  fireEvent.change(screen.getByLabelText("監督名"), {
    target: { value: "  高城 監督  " },
  });
  fireEvent.change(screen.getByLabelText("都道府県"), {
    target: { value: "region.chiba" },
  });
}

describe("SchoolSetupScreen", () => {
  it("submits trimmed school settings and shows immediate progress", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((promiseResolve) => {
      resolve = promiseResolve;
    });
    const onSubmit = vi.fn(() => pending);
    render(<SchoolSetupScreen onSubmit={onSubmit} />);
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "学校を作成" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "学校データを作成しています…",
    );
    expect(screen.getByRole("button", { name: "作成中…" })).toBeDisabled();
    expect(onSubmit).toHaveBeenCalledWith({
      displayName: "たく監督",
      schoolName: "青葉高校",
      schoolShortName: "青葉",
      coachName: "高城 監督",
      regionId: "region.chiba",
    });

    resolve();
  });

  it("keeps entered values after a failed submission and remains retryable", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network"));
    render(<SchoolSetupScreen onSubmit={onSubmit} />);
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "学校を作成" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "学校データを作成できませんでした",
    );
    expect(screen.getByLabelText("学校名")).toHaveValue("  青葉高校  ");
    expect(screen.getByLabelText("監督名")).toHaveValue("  高城 監督  ");
    expect(screen.getByRole("button", { name: "学校を作成" })).toBeEnabled();
  });
});
