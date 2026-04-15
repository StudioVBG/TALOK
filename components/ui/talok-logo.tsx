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

// ── TalokLogo (horizontal logo PNG — badge intégré + texte) ─
interface LogoProps {
  size?: Size;
  /** Conservé pour compatibilité — si false, affiche uniquement le badge carré */
  showText?: boolean;
  className?: string;
}

const LOGO_CLS: Record<Size, string> = {
  xs: "h-5 w-auto",
  sm: "h-7 w-auto",
  md: "h-9 w-auto",
  lg: "h-12 w-auto",
  xl: "h-14 w-auto",
};

export function TalokLogo({
  size = "md",
  showText = true,
  className,
}: LogoProps) {
  // Si showText=false, on affiche uniquement le badge (icône carrée)
  if (!showText) {
    return <TalokBadge size={size} className={className} />;
  }

  return (
    <Image
      src="/images/talok-logo-horizontal.png"
      alt="TALOK"
      width={160}
      height={64}
      className={cn("shrink-0 object-contain", LOGO_CLS[size], className)}
    />
  );
}
