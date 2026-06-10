import type { HTMLAttributes } from "react";

type Tone = "card" | "sunken" | "inset";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  pad?: number | string;
  elevated?: boolean;
}

const tones: Record<Tone, string> = {
  card: "bg-[var(--surface-card)]",
  sunken: "bg-[var(--surface-sunken)]",
  inset: "bg-[var(--surface-inset)]",
};

const paddingClasses: Record<string, string> = {
  "16": "p-4",
  "18": "p-[18px]",
};

export function Card({ children, tone = "card", pad = 18, elevated = false, className = "", ...props }: CardProps) {
  const padding = paddingClasses[String(pad)] ?? "p-[18px]";

  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-[var(--border-subtle)] ${tones[tone]} ${padding} ${elevated ? "shadow-[var(--shadow-card)]" : "shadow-none"} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
