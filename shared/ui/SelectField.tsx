"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/utils";

export interface SelectFieldOption {
  value: string | number;
  label: string;
  description?: string;
  color?: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  options: SelectFieldOption[];
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  name?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  buttonClassName?: string;
  accentColor?: string;
  title?: string;
}

interface FloatingPosition {
  top: number;
  left: number;
  width: number;
}

const EMPTY_VALUE = "";

export function SelectField({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  label,
  placeholder = "Выбрать",
  disabled = false,
  compact = false,
  className,
  buttonClassName,
  accentColor,
  title,
}: SelectFieldProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const [internalValue, setInternalValue] = useState(() => stringifyValue(defaultValue ?? options[0]?.value ?? EMPTY_VALUE));

  const selectedValue = stringifyValue(value ?? internalValue);
  const selectedOption = useMemo(
    () => options.find((option) => stringifyValue(option.value) === selectedValue),
    [options, selectedValue],
  );
  const resolvedAccent = accentColor ?? selectedOption?.color ?? "var(--accent-400)";
  const selectedLabel = selectedOption?.label ?? placeholder;

  function updatePosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 7,
      left: rect.left,
      width: rect.width,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, selectedValue, options.length]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleViewportChange() {
      updatePosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  function commit(nextValue: string) {
    const option = options.find((item) => stringifyValue(item.value) === nextValue);
    if (!option || option.disabled) return;
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const enabled = options.filter((option) => !option.disabled);
    const currentIndex = Math.max(0, enabled.findIndex((option) => stringifyValue(option.value) === selectedValue));

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((next) => !next);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = enabled[(currentIndex + delta + enabled.length) % enabled.length];
      if (next) commit(stringifyValue(next.value));
    }
  }

  const control = (
    <div ref={rootRef} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={selectedValue} disabled={disabled} />}
      <button
        ref={triggerRef}
        type="button"
        title={title ?? selectedLabel}
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((next) => !next)}
        onKeyDown={handleKeyDown}
        className={cn(
          "group/select relative flex w-full cursor-pointer items-center gap-2 overflow-hidden text-left outline-none transition-all disabled:cursor-not-allowed disabled:opacity-45",
          compact ? "min-h-8 rounded-lg px-2.5 py-1 text-xs" : "min-h-[38px] rounded-xl px-3 py-2 text-sm",
          "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]",
          buttonClassName,
        )}
        style={{ ...selectButtonStyle(open, resolvedAccent), ["--select-accent" as string]: resolvedAccent }}
      >
        <span className="pointer-events-none absolute inset-y-1 left-1 w-0.5 rounded-full opacity-80" style={{ background: resolvedAccent }} />
        {selectedOption?.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_12px_currentColor]" style={{ background: selectedOption.color, color: selectedOption.color }} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[var(--text-primary)]">{selectedLabel}</span>
          {label && <span className="block truncate text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</span>}
        </span>
        <svg
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-150", open && "rotate-180")}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: resolvedAccent }}
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
    </div>
  );

  return (
    <>
      {control}
      {open && position && typeof document !== "undefined" && createPortal(
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={label ?? title ?? placeholder}
          className="z-[9999] max-h-72 overflow-y-auto rounded-xl p-1 shadow-2xl backdrop-blur-xl"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: Math.max(position.width, 180),
            background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 96%, white 4%), var(--bg-elevated))",
            border: "1px solid var(--glass-border-active)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.48), 0 0 0 1px var(--glass-border), 0 0 28px color-mix(in srgb, var(--select-accent, var(--accent-400)) 14%, transparent)",
            ["--select-accent" as string]: resolvedAccent,
          }}
        >
          {options.map((option) => {
            const optionValue = stringifyValue(option.value);
            const selected = optionValue === selectedValue;
            const color = option.color ?? resolvedAccent;
            return (
              <button
                key={optionValue}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onClick={() => commit(optionValue)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40",
                  selected ? "bg-[var(--accent-glow)]" : "hover:bg-[var(--glass-02)]",
                )}
                style={{ color: selected ? color : "var(--text-secondary)" }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, opacity: selected || option.color ? 1 : 0.32 }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">{option.label}</span>
                  {option.description && <span className="block truncate text-[10px] text-[var(--text-muted)]">{option.description}</span>}
                </span>
                {selected && <span className="text-[11px] font-bold" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

function stringifyValue(value: string | number | undefined) {
  return value === undefined ? EMPTY_VALUE : String(value);
}

function selectButtonStyle(open: boolean, accent: string): CSSProperties {
  return {
    background: open
      ? "linear-gradient(135deg, color-mix(in srgb, var(--select-accent) 13%, var(--glass-02)), var(--glass-01))"
      : "linear-gradient(135deg, var(--glass-01), color-mix(in srgb, var(--glass-02) 46%, transparent))",
    border: `1px solid ${open ? "color-mix(in srgb, var(--select-accent) 48%, var(--glass-border))" : "var(--glass-border)"}`,
    color: "var(--text-primary)",
    boxShadow: open
      ? "0 0 0 3px color-mix(in srgb, var(--select-accent) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.04)"
      : "inset 0 1px 0 rgba(255,255,255,0.025)",
    ["--select-accent" as string]: accent,
  };
}
