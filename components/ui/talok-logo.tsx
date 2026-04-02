"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * SVG path for the Talok mark — a house-shaped monogram (T + A-keyhole + L).
 *
 * Outer: house with roof peak top-left, right wall, L-extension bottom-right.
 * Inner: keyhole cutout (circle + narrow slot) using evenodd fill-rule.
 */
const MARK_VB = "0 0 48 50";
const MARK_D = [
  // Outer house + L shape
  "M6 2 L34 22 L34 36 L46 36 L46 48 L22 48 L22 42 L6 42Z",
  // Keyhole: slot merging into circle arc (single sub-path, no overlap)
  "M18 38 L18 31.58 A5 5 0 1 1 22 31.58 L22 38Z",
].join(" ");

// Brand gradient stops
const GRAD_START = "#1a56db";
const GRAD_END = "#4a90e2";

// ────────────────────────────────────────────────────────────
type Size = "xs" | "sm" | "md" | "lg" | "xl";
type Variant = "color" | "mono" | "inverse";

const MARK_H: Record<Size, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
};

const TEXT_CLS: Record<Size, string> = {
  xs: "text-sm",
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

// ── TalokMark ──────────────────────────────────────────────
interface MarkProps {
  size?: Size;
  variant?: Variant;
  className?: string;
}

export function TalokMark({
  size = "md",
  variant = "color",
  className,
}: MarkProps) {
  const uid = useId();
  const h = MARK_H[size];
  const w = Math.round(h * (48 / 50));

  const fill =
    variant === "color"
      ? `url(#tm${uid})`
      : variant === "inverse"
        ? "white"
        : "currentColor";

  return (
    <svg
      viewBox={MARK_VB}
      width={w}
      height={h}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {variant === "color" && (
        <defs>
          <linearGradient
            id={`tm${uid}`}
            x1="0"
            y1="0"
            x2="48"
            y2="50"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={GRAD_START} />
            <stop offset="1" stopColor={GRAD_END} />
          </linearGradient>
        </defs>
      )}
      <path fillRule="evenodd" clipRule="evenodd" d={MARK_D} fill={fill} />
    </svg>
  );
}

// ── TalokBadge ─────────────────────────────────────────────
interface BadgeProps {
  size?: Size;
  className?: string;
}

export function TalokBadge({ size = "md", className }: BadgeProps) {
  const uid = useId();
  const dim = MARK_H[size];

  return (
    <svg
      viewBox="0 0 64 64"
      width={dim}
      height={dim}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`tb${uid}`}
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={GRAD_START} />
          <stop offset="1" stopColor={GRAD_END} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#tb${uid})`} />
      <g transform="translate(10 10) scale(0.85)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d={MARK_D}
          fill="white"
        />
      </g>
    </svg>
  );
}

// ── TalokLogo (horizontal: badge + text) ───────────────────
interface LogoProps {
  size?: Size;
  variant?: Variant;
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

export function TalokLogo({
  size = "md",
  variant = "color",
  showText = true,
  className,
  textClassName,
}: LogoProps) {
  const textColor =
    variant === "inverse"
      ? "text-white"
      : variant === "mono"
        ? ""
        : "text-foreground";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <TalokBadge size={size} />
      {showText && (
        <span
          className={cn(
            "font-display font-extrabold tracking-tight",
            TEXT_CLS[size],
            textColor,
            textClassName,
          )}
        >
          TALOK
        </span>
      )}
    </span>
  );
}
