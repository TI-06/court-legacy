import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OperationBlockingOverlay } from "../../../src/ui/status/OperationBlockingOverlay";
describe("OperationBlockingOverlay", () => {
  it("blocks the viewport while an operation is submitting", () => {
    render(
      <OperationBlockingOverlay
        operation={{
          status: "submitting",
          label: "練習設定を保存しています…",
          operationId: "phase12-test",
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "練習設定を保存しています…",
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
  it("does not block while idle", () => {
    render(<OperationBlockingOverlay operation={{ status: "idle" }} />);
    expect(screen.queryByTestId("operation-blocking-overlay")).toBeNull();
  });
});
