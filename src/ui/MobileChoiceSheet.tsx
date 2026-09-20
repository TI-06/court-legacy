import { useState } from "react";
import { BottomSheet } from "./BottomSheet";

export interface MobileChoiceOption<Value extends string = string> {
  value: Value;
  label: string;
  description?: string;
  meta?: string;
}

interface MobileChoiceSheetProps<Value extends string> {
  label: string;
  ariaLabel?: string;
  title?: string;
  description?: string;
  value: Value;
  options: readonly MobileChoiceOption<Value>[];
  onChange: (value: Value) => void;
  disabled?: boolean;
  placeholder?: string;
  layout?: "list" | "grid";
  className?: string;
}

export function MobileChoiceSheet<Value extends string>({
  label,
  ariaLabel,
  title,
  description,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "選択してください",
  layout = "list",
  className,
}: MobileChoiceSheetProps<Value>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div
      className={["mobile-choice-field", className].filter(Boolean).join(" ")}
    >
      <span className="mobile-choice-field__label">{label}</span>
      <button
        aria-label={ariaLabel ?? label}
        className="mobile-choice-trigger"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span>{selected?.label ?? placeholder}</span>
        <b aria-hidden="true">›</b>
      </button>
      <BottomSheet
        className="ui-bottom-sheet--game-choice"
        description={description}
        onClose={() => setOpen(false)}
        open={open}
        title={title ?? `${label}を選ぶ`}
      >
        <div
          aria-label={`${label}候補`}
          className={`mobile-choice-list mobile-choice-list--${layout}`}
          role="group"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                aria-label={option.label}
                aria-pressed={active}
                className={
                  active
                    ? "mobile-choice-option is-selected"
                    : "mobile-choice-option"
                }
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                type="button"
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description ? (
                    <small>{option.description}</small>
                  ) : null}
                </span>
                {option.meta ? <b>{option.meta}</b> : null}
                <i aria-hidden="true">{active ? "✓" : "›"}</i>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
