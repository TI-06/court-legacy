import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SchoolSetupScreen } from "../../../../src/features/onboarding/SchoolSetupScreen";

const accountProfile = {
  loginId: "coach.taku",
  coachName: "高城 監督",
  schoolName: "青葉高校",
};

function renderScreen(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <SchoolSetupScreen accountProfile={accountProfile} onSubmit={onSubmit} />,
  );
  return onSubmit;
}

describe("SchoolSetupScreen", () => {
  it("shows registered account values and only asks for remaining school settings", () => {
    renderScreen();

    expect(screen.getByText("coach.taku")).toBeVisible();
    expect(screen.getByText("高城 監督")).toBeVisible();
    expect(screen.getByText("青葉高校")).toBeVisible();
    expect(screen.queryByLabelText("表示名")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("学校名")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("監督名")).not.toBeInTheDocument();
    expect(screen.getByLabelText("略称")).toHaveValue("青葉");
    expect(screen.getByLabelText("都道府県")).toHaveValue("region.chiba");
  });

  it("submits registered profile values with the chosen short name and region", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((promiseResolve) => {
      resolve = promiseResolve;
    });
    const onSubmit = vi.fn(() => pending);
    renderScreen(onSubmit);

    fireEvent.change(screen.getByLabelText("略称"), {
      target: { value: "  青葉VC  " },
    });
    fireEvent.change(screen.getByLabelText("都道府県"), {
      target: { value: "region.tokyo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "学校を作成" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "学校データを作成しています…",
    );
    expect(screen.getByRole("button", { name: "作成中…" })).toBeDisabled();
    expect(onSubmit).toHaveBeenCalledWith({
      displayName: "coach.taku",
      schoolName: "青葉高校",
      schoolShortName: "青葉VC",
      coachName: "高城 監督",
      regionId: "region.tokyo",
    });

    resolve();
  });

  it("keeps entered values after a failed submission and remains retryable", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network"));
    renderScreen(onSubmit);
    fireEvent.change(screen.getByLabelText("略称"), {
      target: { value: "青葉VC" },
    });
    fireEvent.click(screen.getByRole("button", { name: "学校を作成" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "学校データを作成できませんでした",
    );
    expect(screen.getByLabelText("略称")).toHaveValue("青葉VC");
    expect(screen.getByRole("button", { name: "学校を作成" })).toBeEnabled();
  });
});
