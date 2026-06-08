import type { ReactNode, CSSProperties } from "react";

/** Full-width alert block — the safety voice of the console. */
export interface AlertBarProps {
  /** @default "warning" */
  tone?: "danger" | "warning" | "info" | "success";
  title?: ReactNode;
  children?: ReactNode;
  /** Override the default tone icon. */
  icon?: ReactNode;
  style?: CSSProperties;
}

export function AlertBar(props: AlertBarProps): JSX.Element;
