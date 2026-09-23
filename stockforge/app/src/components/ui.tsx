import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "up" | "down" | "neutral";
}) {
  const color =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-white";
  return (
    <div className="card px-5 py-4">
      <div className="text-[11px] uppercase tracking-widest text-ink-400">
        {label}
      </div>
      <div className={`num mt-2 text-2xl font-semibold ${color}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-ink-400">{sub}</div> : null}
    </div>
  );
}

type Tone = "up" | "down" | "warn" | "muted" | "brand";

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    up: "bg-up/10 text-up border-up/30",
    down: "bg-down/10 text-down border-down/30",
    warn: "bg-accent/10 text-accent border-accent/30",
    muted: "bg-ink-700/40 text-ink-300 border-ink-700",
    brand: "bg-brand/10 text-brand border-brand/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
          {label}
        </span>
        {hint ? <span className="text-[11px] text-ink-600">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white outline-none transition focus:border-brand/60 num";

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  title?: string;
}) {
  const variants = {
    primary: "bg-brand text-[#05221a] hover:bg-brand/90 disabled:bg-ink-700 disabled:text-ink-400",
    ghost:
      "border border-ink-700 text-ink-200 hover:border-ink-600 hover:text-white",
    danger: "bg-down/90 text-white hover:bg-down",
  };
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-400">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-600 border-t-brand" />
      {label}
    </span>
  );
}
