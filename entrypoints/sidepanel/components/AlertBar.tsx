import type { HTMLAttributes, ReactNode } from "react";

type Tone = "danger" | "warning" | "info" | "success";

interface AlertBarProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  title?: string;
  icon?: ReactNode;
}

const glyphs: Record<Tone, string> = {
  danger: "!",
  warning: "!",
  info: "i",
  success: "✓",
};

const tones: Record<Tone, { bar: string; icon: string; text: string }> = {
  danger: { bar: "border-[var(--danger-bd)] bg-[var(--danger-soft)]", icon: "text-[var(--danger)]", text: "text-[var(--danger-text)]" },
  warning: { bar: "border-[var(--warning-bd)] bg-[var(--warning-soft)]", icon: "text-[var(--warning)]", text: "text-[var(--warning-text)]" },
  info: { bar: "border-[var(--info-bd)] bg-[var(--info-soft)]", icon: "text-[var(--info)]", text: "text-[var(--info-text)]" },
  success: { bar: "border-[var(--success-bd)] bg-[var(--success-soft)]", icon: "text-[var(--success)]", text: "text-[var(--success-text)]" },
};

export function AlertBar({ children, tone = "warning", title, icon, className = "", ...props }: AlertBarProps) {
  const t = tones[tone];

  return (
    <div role="alert" className={`flex items-start gap-[11px] rounded-[var(--radius-lg)] border px-[14px] py-3 ${t.bar} ${className}`} {...props}>
      <span className={`mt-px inline-flex h-[18px] w-[18px] flex-none items-center justify-center ${t.icon} [&>svg]:h-full [&>svg]:w-full`}>{icon ?? glyphs[tone]}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        {title ? <div className={`[font:var(--fw-bold)_var(--fs-sm)/1.4_var(--font-sans)] ${t.text}`}>{title}</div> : null}
        {children ? <div className={`opacity-92 [font:var(--fs-sm)/1.55_var(--font-sans)] ${t.text}`}>{children}</div> : null}
      </div>
    </div>
  );
}
