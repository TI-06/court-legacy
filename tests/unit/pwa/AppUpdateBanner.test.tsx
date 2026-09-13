import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ComponentType } from "react";
import { vi } from "vitest";

const subjectPath = "../../../src/pwa/AppUpdateBanner";
const refreshButtonName = "更新して再読み込み";

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
    const props = {
      updateReady: false,
      onRefresh: () => undefined,
    };
    render(createElement(AppUpdateBanner, props));

    const status = screen.queryByRole("status");
    const button = screen.queryByRole("button", { name: refreshButtonName });
    expect(status).toBeNull();
    expect(button).toBeNull();
  });

  it("shows a controlled refresh action when an update is ready", async () => {
    const AppUpdateBanner = await loadBanner();
    const onRefresh = vi.fn();
    const props = { updateReady: true, onRefresh };
    render(createElement(AppUpdateBanner, props));

    const status = screen.getByRole("status");
    const button = screen.getByRole("button", { name: refreshButtonName });
    expect(status).toHaveTextContent("新しいバージョンを利用できます");
    fireEvent.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
