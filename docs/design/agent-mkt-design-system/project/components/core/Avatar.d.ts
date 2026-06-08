import type { CSSProperties } from "react";

/** Handle avatar — initial monogram (default) or image; tint derives from the handle. */
export interface AvatarProps {
  /** Threads handle, with or without leading @. */
  handle?: string;
  /** Optional image URL; falls back to monogram. */
  src?: string;
  /** Pixel diameter. @default 36 */
  size?: number;
  style?: CSSProperties;
}

export function Avatar(props: AvatarProps): JSX.Element;
