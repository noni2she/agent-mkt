import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  full?: boolean;
}

const sizeStyles: Record<Size, { button: string; icon: string }> = {
  sm: { button: "h-[30px] px-[10px] gap-[6px] [font:var(--fw-medium)_13px/1_var(--font-sans)]", icon: "h-[15px] w-[15px]" },
  md: { button: "h-[38px] px-[15px] gap-[7px] [font:var(--fw-medium)_14px/1_var(--font-sans)]", icon: "h-[17px] w-[17px]" },
  lg: { button: "h-[46px] px-5 gap-2 [font:var(--fw-medium)_15.5px/1_var(--font-sans)]", icon: "h-[19px] w-[19px]" },
};

const variants: Record<Variant, string> = {
  primary: "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand)] hover:border-[var(--brand-hover)] hover:bg-[var(--brand-hover)]",
  secondary: "border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-strong)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-inset)]",
  ghost: "border-transparent bg-transparent text-[var(--text-body)] hover:bg-[var(--surface-inset)]",
  danger: "border-[var(--danger-bd)] bg-[var(--surface-card)] text-[var(--danger-text)] hover:border-[var(--danger)] hover:bg-[var(--danger-soft)]",
};

export function Button({ children, variant = "secondary", size = "md", icon, iconRight, full = false, className = "", ...props }: ButtonProps) {
  const s = sizeStyles[size];
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border transition-[background,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)] disabled:cursor-not-allowed disabled:opacity-45 ${full ? "w-full" : "w-auto"} ${s.button} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon ? <span className={`inline-flex [&>svg]:h-full [&>svg]:w-full ${s.icon}`}>{icon}</span> : null}
      {children}
      {iconRight ? <span className={`inline-flex [&>svg]:h-full [&>svg]:w-full ${s.icon}`}>{iconRight}</span> : null}
    </button>
  );
}
