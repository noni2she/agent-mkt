import type { ChangeEvent, CSSProperties } from "react";

/** Labeled single-line text input. */
export interface FieldProps {
  label?: string;
  hint?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  /** Red border + danger hint. */
  invalid?: boolean;
  /** Monospace input (for handles / keywords / IDs). */
  mono?: boolean;
  style?: CSSProperties;
}

export function Field(props: FieldProps): JSX.Element;
