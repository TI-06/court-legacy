import type { ButtonHTMLAttributes, ReactNode } from "react";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
}

export function GameButton({
  children,
  className,
  type = "button",
  variant = "secondary",
  ...props
}: GameButtonProps) {
  const classes = ["game-button", `game-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
