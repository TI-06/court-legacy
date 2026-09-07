import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OperationBlockingOverlay } from "../../../../src/ui/status/OperationBlockingOverlay";

describe("OperationBlockingOverlay", () => {
  it("does not block the whole game while a facility level is being saved", () => {
    render(
      <OperationBlockingOverlay
        operation={{
          status: "submitting",
          label: "施設を更新しています…",
          operationId: "facility-1",
        }}
      />,
    );

    expect(screen.queryByTestId("operation-blocking-overlay")).toBeNull();
  });

  it("still blocks heavyweight week progression", () => {
    render(
      <OperationBlockingOverlay
        operation={{
          status: "submitting",
          label: "練習を実施して次の週へ進めています…",
          operationId: "week-1",
        }}
      />,
    );

    expect(screen.getByTestId("operation-blocking-overlay")).toBeVisible();
  });
});
