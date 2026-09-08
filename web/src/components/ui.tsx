"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-lg border border-[var(--color-border)] bg-white/95 p-4 backdrop-blur-[6px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm" | "icon";
}) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors disabled:opacity-50",
        size === "md" && "px-4 py-2",
        size === "sm" && "h-8 gap-1.5 px-2.5 text-xs",
        size === "icon" && "h-8 w-8 p-0",
        variant === "primary" &&
          "bg-[var(--color-atlas-navy)] text-white hover:bg-[#14154a]",
        variant === "secondary" &&
          "border border-[var(--color-border)] bg-white text-[var(--color-atlas-navy)] hover:bg-slate-50",
        variant === "ghost" && "text-[var(--color-atlas-navy)] hover:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warn" | "error" | "info";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    error: "bg-red-100 text-red-800",
    info: "bg-sky-100 text-sky-800",
  };
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", tones[tone])}>
      {children}
    </span>
  );
}

/** Plain text input — contact/company browser autofill off by default. */
export function Input({
  className,
  autoComplete = "off",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-atlas-sky)] focus:ring-2 focus:ring-[var(--color-atlas-sky)]/20",
        className,
      )}
      autoComplete={autoComplete}
      autoCorrect="off"
      spellCheck={false}
    />
  );
}

/**
 * Number field that shows blank instead of "0" so users can type immediately.
 * Keeps a string draft so decimals like "1." / "0.04" are not eaten by Number().
 */
function decimalPlacesFromStep(step?: string | number): number {
  if (step == null || step === "any") return 2;
  const s = String(step);
  if (!s.includes(".")) return 0;
  return s.split(".")[1]?.length ?? 0;
}

/** Keep rates like 1.50 and 0.04 visible (not 1.5 / 0.04 truncated oddly). */
function formatRateDraft(n: number, step?: string | number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  const places = decimalPlacesFromStep(step);
  if (places <= 0) return String(n);
  return n.toFixed(places);
}

export function NumberInput({
  value,
  onValueChange,
  className,
  step,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (n: number) => void;
}) {
  const stepAttr = step ?? "0.01";
  const [draft, setDraft] = useState(() => formatRateDraft(value, stepAttr));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setDraft(formatRateDraft(value, stepAttr));
  }, [value, focused, stepAttr]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      step={stepAttr}
      className={className}
      value={draft}
      placeholder={props.placeholder ?? "0"}
      autoComplete="off"
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "").trim();
        if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
          setDraft(raw);
          onValueChange(0);
          return;
        }
        if (!/^-?\d*(\.\d*)?$/.test(raw)) return;
        setDraft(raw);
        if (raw.endsWith(".")) return;
        const n = Number(raw);
        if (Number.isFinite(n)) onValueChange(n);
      }}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        const n = Number(draft);
        const next = Number.isFinite(n) ? n : 0;
        setDraft(formatRateDraft(next, stepAttr));
        onValueChange(next);
        props.onBlur?.(e);
      }}
    />
  );
}

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-sm font-semibold", className)} {...props}>
      {children}
    </label>
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-atlas-sky)] focus:ring-2 focus:ring-[var(--color-atlas-sky)]/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-atlas-sky)] focus:ring-2 focus:ring-[var(--color-atlas-sky)]/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Simple tabs bar — shadcn-compatible API without Radix dependency yet */
export function Tabs({
  value,
  onValueChange,
  items,
}: {
  value: string;
  onValueChange: (v: string) => void;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onValueChange(item.value)}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
            value === item.value
              ? "bg-[var(--color-atlas-navy)] text-white"
              : "text-[var(--color-text-muted)] hover:bg-slate-100",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
