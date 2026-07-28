import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";

describe("team selection UI", () => {
  it("opens the Team tab with six rotation slots and one libero", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    expect(
      screen.getByRole("heading", { name: "チーム編成" }),
    ).toBeInTheDocument();
    for (let slot = 1; slot <= 6; slot += 1) {
      expect(
        screen.getByRole("combobox", { name: `ローテーション${slot}` }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("combobox", { name: "リベロ" })).toBeInTheDocument();
    expect(screen.getAllByTestId("bench-player")).toHaveLength(5);
  });

  it("keeps every school player available in active-player selectors", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    const rotation = screen.getByRole("combobox", { name: "ローテーション1" });
    const libero = screen.getByRole("combobox", { name: "リベロ" });

    expect(within(rotation).getAllByRole("option")).toHaveLength(12);
    expect(within(libero).getAllByRole("option")).toHaveLength(12);
  });

  it("manually replaces a rotation player without creating duplicate active players", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    const rotation = screen.getByRole("combobox", {
      name: "ローテーション1",
    }) as HTMLSelectElement;
    const replacement = [...rotation.options].find(
      (option) => !option.disabled && option.value !== rotation.value,
    );
    expect(replacement).toBeDefined();

    fireEvent.change(rotation, { target: { value: replacement!.value } });

    expect(rotation.value).toBe(replacement!.value);
    expect(screen.getByText("編成は有効です")).toBeInTheDocument();
  });

  it("persists starter locks and safety settings across tab changes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    const starterLock = screen.getAllByRole("checkbox", {
      name: /先発固定/,
    })[0]!;
    const injurySafety = screen.getByRole("checkbox", {
      name: "怪我時はベンチを許可",
    });
    fireEvent.click(starterLock);
    fireEvent.click(injurySafety);

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    expect(
      screen.getAllByRole("checkbox", { name: /先発固定/ })[0],
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "怪我時はベンチを許可" }),
    ).not.toBeChecked();
  });

  it("can rebuild and safety-adjust the lineup", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    fireEvent.click(screen.getByRole("button", { name: "自動編成" }));
    fireEvent.click(screen.getByRole("button", { name: "安全調整" }));

    expect(screen.getByText("編成は有効です")).toBeInTheDocument();
  });
});
