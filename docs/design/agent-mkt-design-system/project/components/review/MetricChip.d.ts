import type { ReactNode, CSSProperties } from "react";

/** Threads engagement metric chip (likes / replies / age / followers). */
export interface MetricChipProps {
  /** @default "likes" */
  kind?: "likes" | "replies" | "age" | "followers";
  /** The value to display (number or preformatted string e.g. "954", "301h"). */
  value?: ReactNode;
  /** Override the leading glyph (emoji or node). */
  glyph?: ReactNode;
  style?: CSSProperties;
}

export function MetricChip(props: MetricChipProps): JSX.Element;
