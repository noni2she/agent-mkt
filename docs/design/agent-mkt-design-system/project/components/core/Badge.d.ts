import type { ReactNode, CSSProperties } from "react";

/** Small quiet label / pill. `tone` tints it; `solid` fills it for counts. */
export interface BadgeProps {
  children?: ReactNode;
  /** @default "neutral" */
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  /** Filled style for counts / strong emphasis. */
  solid?: boolean;
  style?: CSSProperties;
}

export function Badge(props: BadgeProps): JSX.Element;
