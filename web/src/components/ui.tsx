import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm",
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
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
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
