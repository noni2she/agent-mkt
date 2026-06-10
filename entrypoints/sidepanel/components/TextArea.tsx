import type { TextareaHTMLAttributes } from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  maxHint?: number;
  empty?: boolean;
}

export function TextArea({ label, maxHint, empty = false, value, className = "", ...props }: TextAreaProps) {
  const len = String(value ?? "").length;
  const over = maxHint != null && len > maxHint;
  return (
    <div className="flex flex-col gap-[6px]">
      {label ? (
        <div className="flex items-baseline justify-between">
          <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">{label}</span>
          {maxHint != null ? <span className={`font-[var(--font-mono)] text-[var(--text-faint)] [font-variant-numeric:tabular-nums] [font:var(--fs-xs)/1_var(--font-mono)] ${over ? "text-[var(--danger-text)]" : ""}`}>{len} / {maxHint}</span> : null}
        </div>
      ) : null}
      <textarea
        className={`w-full resize-y rounded-[var(--radius-md)] px-[14px] py-3 text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] [font:var(--fw-regular)_var(--fs-body)/var(--lh-relaxed)_var(--font-sans)] ${empty ? "border-[1.5px] border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)] text-[var(--text-faint)]" : "border border-[var(--border-default)] bg-[var(--surface-card)] focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]"} ${className}`}
        value={value}
        {...props}
      />
    </div>
  );
}
