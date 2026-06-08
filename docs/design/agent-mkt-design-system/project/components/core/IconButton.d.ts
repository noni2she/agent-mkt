import type { ReactNode, CSSProperties } from "react";

/** Square icon-only button for toolbars and row actions. */
export interface IconButtonProps {
  /** Icon node (e.g. a Lucide <i>). */
  icon: ReactNode;
  /** Accessible label (also the tooltip). */
  label: string;
  /** @default "ghost" */
  variant?: "ghost" | "solid" | "danger";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function IconButton(props: IconButtonProps): JSX.Element;
