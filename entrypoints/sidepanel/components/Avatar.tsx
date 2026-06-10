import type { HTMLAttributes } from "react";

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  handle?: string;
  src?: string;
  size?: number;
}

const hueClasses = [
  "[background:oklch(0.92_0.05_0)] text-[oklch(0.45_0.09_0)]",
  "[background:oklch(0.92_0.05_30)] text-[oklch(0.45_0.09_30)]",
  "[background:oklch(0.92_0.05_60)] text-[oklch(0.45_0.09_60)]",
  "[background:oklch(0.92_0.05_90)] text-[oklch(0.45_0.09_90)]",
  "[background:oklch(0.92_0.05_120)] text-[oklch(0.45_0.09_120)]",
  "[background:oklch(0.92_0.05_150)] text-[oklch(0.45_0.09_150)]",
  "[background:oklch(0.92_0.05_180)] text-[oklch(0.45_0.09_180)]",
  "[background:oklch(0.92_0.05_210)] text-[oklch(0.45_0.09_210)]",
  "[background:oklch(0.92_0.05_240)] text-[oklch(0.45_0.09_240)]",
  "[background:oklch(0.92_0.05_270)] text-[oklch(0.45_0.09_270)]",
  "[background:oklch(0.92_0.05_300)] text-[oklch(0.45_0.09_300)]",
  "[background:oklch(0.92_0.05_330)] text-[oklch(0.45_0.09_330)]",
];

const sizeClasses: Record<number, string> = {
  30: "h-[30px] w-[30px] text-[13px]",
  36: "h-9 w-9 text-[15px]",
};

export function Avatar({ handle = "", src, size = 36, className = "", ...props }: AvatarProps) {
  const clean = handle.replace(/^@/, "");
  const initial = clean ? clean[0]?.toUpperCase() : "?";
  let h = 0;
  for (let i = 0; i < clean.length; i += 1) h = (h * 31 + clean.charCodeAt(i)) % 360;
  const toneClass = src ? "bg-[var(--surface-inset)] text-[var(--text-body)]" : hueClasses[Math.floor(h / 30)];
  const sizeClass = sizeClasses[size] ?? sizeClasses[36];

  return (
    <span
      title={clean ? `@${clean}` : undefined}
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border-subtle)] font-[var(--fw-bold)] leading-none ${sizeClass} ${toneClass} ${className}`}
      {...props}
    >
      {src ? <img src={src} alt={clean} /> : initial}
    </span>
  );
}
