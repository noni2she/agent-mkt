import type { HTMLAttributes } from "react";

type Status = "pending" | "approved" | "sent" | "skipped" | "rejected" | "later" | "blocked" | "relevant";

const statusTone: Record<Status, string> = {
  pending: "warning",
  approved: "success",
  sent: "success",
  skipped: "neutral",
  rejected: "neutral",
  later: "info",
  blocked: "danger",
  relevant: "brand",
};

const labels: Record<Status, string> = {
  pending: "待審",
  approved: "通過",
  sent: "已送出",
  skipped: "跳過",
  rejected: "跳過",
  later: "稍後再看",
  blocked: "命中硬規則",
  relevant: "相關",
};

const tones: Record<string, { chip: string; dot: string }> = {
  neutral: { chip: "border-[var(--border-default)] bg-[var(--surface-inset)] text-[var(--text-muted)]", dot: "bg-[var(--ink-400)]" },
  brand: { chip: "border-[var(--brand-soft-bd)] bg-[var(--brand-soft)] text-[var(--brand-700)]", dot: "bg-[var(--brand)]" },
  success: { chip: "border-[var(--success-bd)] bg-[var(--success-soft)] text-[var(--success-text)]", dot: "bg-[var(--success)]" },
  warning: { chip: "border-[var(--warning-bd)] bg-[var(--warning-soft)] text-[var(--warning-text)]", dot: "bg-[var(--warning)]" },
  danger: { chip: "border-[var(--danger-bd)] bg-[var(--danger-soft)] text-[var(--danger-text)]", dot: "bg-[var(--danger)]" },
  info: { chip: "border-[var(--info-bd)] bg-[var(--info-soft)] text-[var(--info-text)]", dot: "bg-[var(--info)]" },
};

interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  status?: Status;
  tone?: string;
}

export function StatusChip({ children, status = "pending", tone, className = "", ...props }: StatusChipProps) {
  const resolvedTone = tone ?? statusTone[status];
  const t = tones[resolvedTone] ?? tones.neutral;

  return (
    <span className={`inline-flex items-center gap-[6px] whitespace-nowrap rounded-full border py-[3px] pr-[10px] pl-2 [font:var(--fw-bold)_var(--fs-xs)/1.5_var(--font-sans)] ${t.chip} ${className}`} {...props}>
      <span className={`h-[7px] w-[7px] flex-none rounded-full ${t.dot}`} />
      {children ?? labels[status]}
    </span>
  );
}
