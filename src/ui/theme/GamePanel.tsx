import type { HTMLAttributes, ReactNode } from "react";

interface GamePanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  tone?: "default" | "strong" | "light" | "accent";
  as?: "section" | "article" | "div";
}

export function GamePanel({
  children,
  tone = "default",
  as: Component = "section",
  className,
  ...props
}: GamePanelProps) {
  const classNames = ["game-panel", `game-panel--${tone}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classNames} {...props}>
      {children}
    </Component>
  );
}
