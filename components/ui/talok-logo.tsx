"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
type Variant = "color" | "mono" | "inverse";

const IMG_SIZE: Record<Size, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
};

const IMG_CLS: Record<Size, string> = {
  xs: "h-4 w-4",
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

const TEXT_CLS: Record<Size, string> = {
  xs: "text-sm",
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

// ── TalokMark (icon only) ──────────────────────────────────
interface MarkProps {
  size?: Size;
  variant?: Variant;
  className?: string;
}

export function TalokMark({ size = "md", className }: MarkProps) {
  const dim = IMG_SIZE[size];
  return (
    <Image
      src="/images/talok-icon.png"
      alt="TALOK"
      width={dim}
      height={dim}
      className={cn("shrink-0 object-contain rounded-md", IMG_CLS[size], className)}
    />
  );
}

// ── TalokBadge ─────────────────────────────────────────────
interface BadgeProps {
  size?: Size;
  className?: string;
}

export function TalokBadge({ size = "md", className }: BadgeProps) {
  const dim = IMG_SIZE[size];
  return (
    <Image
      src="/images/talok-icon.png"
      alt="TALOK"
      width={dim}
      height={dim}
      className={cn("shrink-0 object-contain rounded-lg", IMG_CLS[size], className)}
    />
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
