import type { HTMLAttributes, ReactNode } from "react";

type Kind = "likes" | "replies" | "age" | "followers";

const glyphs: Record<Kind, string> = {
  likes: "👍",
  replies: "💬",
  age: "◷",
  followers: "👥",
};

const glyphColors: Record<Kind, string> = {
  likes: "text-[var(--coral-600)]",
  replies: "text-[var(--text-muted)]",
  age: "text-[var(--text-muted)]",
  followers: "text-[var(--text-muted)]",
};

interface MetricChipProps extends HTMLAttributes<HTMLSpanElement> {
  kind?: Kind;
  value: ReactNode;
  glyph?: ReactNode;
}

export function MetricChip({ kind = "likes", value, glyph, className = "", ...props }: MetricChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-[9px] py-[3px] font-[var(--font-mono)] text-[var(--text-body)] [font-variant-numeric:tabular-nums] [font:var(--fw-medium)_var(--fs-mono)/1_var(--font-mono)] ${className}`}
      {...props}
    >
      <span className={`inline-flex text-[12px] leading-none ${glyphColors[kind]}`}>{glyph ?? glyphs[kind]}</span>
      {value}
    </span>
  );
}
