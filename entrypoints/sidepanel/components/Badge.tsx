import type { HTMLAttributes } from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  solid?: boolean;
}

const tones: Record<Tone, { soft: string; border: string; text: string; solid: string }> = {
  neutral: { soft: "bg-[var(--surface-inset)]", border: "border-[var(--border-default)]", text: "text-[var(--text-muted)]", solid: "bg-[var(--ink-700)]" },
  brand: { soft: "bg-[var(--brand-soft)]", border: "border-[var(--brand-soft-bd)]", text: "text-[var(--brand-text)]", solid: "bg-[var(--brand)]" },
  success: { soft: "bg-[var(--success-soft)]", border: "border-[var(--success-bd)]", text: "text-[var(--success-text)]", solid: "bg-[var(--success)]" },
  warning: { soft: "bg-[var(--warning-soft)]", border: "border-[var(--warning-bd)]", text: "text-[var(--warning-text)]", solid: "bg-[var(--warning)]" },
  danger: { soft: "bg-[var(--danger-soft)]", border: "border-[var(--danger-bd)]", text: "text-[var(--danger-text)]", solid: "bg-[var(--danger)]" },
  info: { soft: "bg-[var(--info-soft)]", border: "border-[var(--info-bd)]", text: "text-[var(--info-text)]", solid: "bg-[var(--info)]" },
};

export function Badge({ children, tone = "neutral", solid = false, className = "", ...props }: BadgeProps) {
  const t = tones[tone];

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-[var(--radius-sm)] border px-2 py-0.5 [font:var(--fw-medium)_var(--fs-xs)/1.5_var(--font-sans)] ${solid ? `border-transparent text-white ${t.solid}` : `${t.border} ${t.soft} ${t.text}`} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
