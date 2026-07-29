import { useEffect, useId, useRef, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
}

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function BottomSheet({
  open,
  title,
  description,
  onClose,
  children,
  dismissible = true,
}: BottomSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(
      focusableSelector,
    );
    (dismissible ? closeButtonRef.current : firstFocusable)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !sheetRef.current) {
        return;
      }

      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        return;
      }

      const currentIndex = focusable.indexOf(
        document.activeElement as HTMLElement,
      );
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = event.shiftKey
        ? (baseIndex - 1 + focusable.length) % focusable.length
        : (baseIndex + 1) % focusable.length;

      event.preventDefault();
      focusable[nextIndex]?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [dismissible, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="ui-sheet-layer">
      {dismissible ? (
        <button
          aria-label="閉じる"
          className="ui-sheet-backdrop"
          onClick={onClose}
          type="button"
        />
      ) : (
        <div aria-hidden="true" className="ui-sheet-backdrop" />
      )}
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="ui-bottom-sheet"
        ref={sheetRef}
        role="dialog"
      >
        <div className="ui-sheet-handle" aria-hidden="true" />
        <header className="ui-sheet-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {dismissible ? (
            <button
              aria-label="閉じる"
              className="ui-icon-button"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              ×
            </button>
          ) : null}
        </header>
        <div className="ui-sheet-content">{children}</div>
      </section>
    </div>
  );
}
