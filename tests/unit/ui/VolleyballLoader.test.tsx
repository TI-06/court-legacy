import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VolleyballLoader } from "../../../src/ui/status/VolleyballLoader";

describe("VolleyballLoader", () => {
  it.each(["tiny", "small", "medium", "large"] as const)(
    "renders the same decorative court and ball at %s size",
    (size) => {
      const { container } = render(
        <span role="status">
          <VolleyballLoader size={size} />
          読み込み中…
        </span>,
      );

      const loader = screen.getByTestId("volleyball-loader");
      expect(loader).toHaveClass(`volleyball-loader--${size}`);
      expect(loader).toHaveAttribute("aria-hidden", "true");
      expect(loader.querySelectorAll(".volleyball-loader__net")).toHaveLength(
        1,
      );
      expect(
        loader.querySelectorAll(".volleyball-loader__ball-flight"),
      ).toHaveLength(1);
      expect(container.querySelectorAll("svg")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent("読み込み中…");
    },
  );

  it("does not create timers or additional status announcements", () => {
    const { container } = render(
      <VolleyballLoader size="small" />,
    );
    expect(container.querySelectorAll("[role='status']")).toHaveLength(0);
    expect(screen.getByTestId("volleyball-loader")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
