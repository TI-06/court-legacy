import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ComponentType } from "react";
import { vi } from "vitest";

const subjectPath = "../../../src/pwa/AppUpdateBanner";

async function loadBanner() {
  const subject = (await import(subjectPath)) as {
    AppUpdateBanner: ComponentType<{
      updateReady: boolean;
      onRefresh: () => void;
    }>;
  };
  return subject.AppUpdateBanner;
}

describe("Phase18 app update banner", () => {
  it("renders nothing when no update is ready", async () => {
    const AppUpdateBanner = await loadBanner();
    render(
      createElement(AppUpdateBanner, {
        updateReady: false,
        onRefresh: () => undefined,
      }),
    );

    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "更新して再読み込み" }),
    ).toBeNull();
  });

  it("shows a controlled refresh action when an update is ready", async () => {
    const AppUpdateBanner = await loadBanner();
    const onRefresh = vi.fn();
    render(createElement(AppUpdateBanner, { updateReady: true, onRefresh }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "新しいバージョンを利用できます",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "更新して再読み込み" }),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
