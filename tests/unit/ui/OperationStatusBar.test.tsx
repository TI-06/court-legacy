import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { OperationStatusBar } from "../../../src/ui/status/OperationStatusBar";

describe("OperationStatusBar", () => {
  it("shows a non-blocking saving state", () => {
    render(
      <OperationStatusBar
        state={{
          status: "submitting",
          label: "週進行を保存",
          operationId: "op-1",
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("保存中…");
  });

  it("shows the saved state after a successful operation", () => {
    render(
      <OperationStatusBar
        state={{ status: "success", label: "週進行を保存" }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("保存済み ✓");
  });

  it("offers a real retry button while offline", () => {
    const retry = vi.fn();
    render(
      <OperationStatusBar
        state={{ status: "offline", label: "週進行を保存", retry }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("オフライン");
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps an error visible with an actionable retry", () => {
    const retry = vi.fn();
    render(
      <OperationStatusBar
        state={{ status: "error", label: "保存に失敗しました", retry }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("保存に失敗しました");
    expect(screen.getByRole("button", { name: "再試行" })).toBeVisible();
  });
});
