/**
 * Static Tailwind class mapping for solution theme colors.
 *
 * Tailwind only ships classes it sees literally in source files (JIT/purge).
 * We therefore expose every variant as a literal string in this file so the
 * build picks them up reliably. Adding a new accent? Add its full block.
 */

import type { SolutionTheme } from "./types";

export type AccentColor = SolutionTheme["accent"];

export interface AccentClasses {
  /** Light tinted bg for icon containers (e.g. bg-emerald-500/15) */
  iconBg: string;
  /** Tinted ring around icon containers */
  iconRing: string;
  /** Hover state stronger ring */
  iconRingHover: string;
  /** Lighter text shade for icons inside containers */
  iconText: string;
  /** Soft background for inline badges */
  badgeBg: string;
  /** Text color for inline badges */
  badgeText: string;
  /** Border color for inline badges */
  badgeBorder: string;
  /** Radial glow color for hero/CTA backdrops */
  radialFrom: string;
  /** Step number circle bg gradient */
  stepGradient: string;
  /** Step circle shadow tint */
  stepShadow: string;
  /** "How it works" connecting line gradient */
  connectorFrom: string;
  connectorVia: string;
  /** Comparison "Avec Talok" header colors */
  withHeaderText: string;
  withHeaderBg: string;
  /** Card hover top-strip gradient via */
  hoverStripVia: string;
  /** Soft glow used behind feature cards on hover */
  hoverGlowBg: string;
  /** Used in stats card top-right glow */
  statsGlowBg: string;
  /** Final CTA card border + bg gradients */
  ctaBorder: string;
  ctaFromBg: string;
  ctaToBg: string;
  /** Shadow on primary CTA button */
  ctaButtonShadow: string;
  ctaButtonShadowHover: string;
}

export const ACCENT: Record<AccentColor, AccentClasses> = {
  emerald: {
    iconBg: "bg-emerald-500/15",
    iconRing: "ring-emerald-500/30",
    iconRingHover: "group-hover:ring-emerald-500/60",
    iconText: "text-emerald-300",
    badgeBg: "bg-emerald-500/20",
    badgeText: "text-emerald-300",
    badgeBorder: "border-emerald-500/30",
    radialFrom: "from-emerald-900/30",
    stepGradient: "from-emerald-400 to-emerald-600",
    stepShadow: "shadow-emerald-500/30",
    connectorFrom: "from-emerald-500/50",
    connectorVia: "via-emerald-500/30",
    withHeaderText: "text-emerald-300",
    withHeaderBg: "bg-emerald-500/5",
    hoverStripVia: "via-emerald-500/60",
    hoverGlowBg: "bg-emerald-500/10",
    statsGlowBg: "bg-emerald-500/10",
    ctaBorder: "border-emerald-500/30",
    ctaFromBg: "from-emerald-900/40",
    ctaToBg: "to-emerald-900/30",
    ctaButtonShadow: "shadow-emerald-500/20",
    ctaButtonShadowHover: "hover:shadow-emerald-500/30",
  },
  orange: {
    iconBg: "bg-orange-500/15",
    iconRing: "ring-orange-500/30",
    iconRingHover: "group-hover:ring-orange-500/60",
    iconText: "text-orange-300",
    badgeBg: "bg-orange-500/20",
    badgeText: "text-orange-300",
    badgeBorder: "border-orange-500/30",
    radialFrom: "from-orange-900/30",
    stepGradient: "from-orange-400 to-orange-600",
    stepShadow: "shadow-orange-500/30",
    connectorFrom: "from-orange-500/50",
    connectorVia: "via-orange-500/30",
    withHeaderText: "text-orange-300",
    withHeaderBg: "bg-orange-500/5",
    hoverStripVia: "via-orange-500/60",
    hoverGlowBg: "bg-orange-500/10",
    statsGlowBg: "bg-orange-500/10",
    ctaBorder: "border-orange-500/30",
    ctaFromBg: "from-orange-900/40",
    ctaToBg: "to-orange-900/30",
    ctaButtonShadow: "shadow-orange-500/20",
    ctaButtonShadowHover: "hover:shadow-orange-500/30",
  },
  sky: {
    iconBg: "bg-sky-500/15",
    iconRing: "ring-sky-500/30",
    iconRingHover: "group-hover:ring-sky-500/60",
    iconText: "text-sky-300",
    badgeBg: "bg-sky-500/20",
    badgeText: "text-sky-300",
    badgeBorder: "border-sky-500/30",
    radialFrom: "from-sky-900/30",
    stepGradient: "from-sky-400 to-sky-600",
    stepShadow: "shadow-sky-500/30",
    connectorFrom: "from-sky-500/50",
    connectorVia: "via-sky-500/30",
    withHeaderText: "text-sky-300",
    withHeaderBg: "bg-sky-500/5",
    hoverStripVia: "via-sky-500/60",
    hoverGlowBg: "bg-sky-500/10",
    statsGlowBg: "bg-sky-500/10",
    ctaBorder: "border-sky-500/30",
    ctaFromBg: "from-sky-900/40",
    ctaToBg: "to-sky-900/30",
    ctaButtonShadow: "shadow-sky-500/20",
    ctaButtonShadowHover: "hover:shadow-sky-500/30",
  },
  indigo: {
    iconBg: "bg-indigo-500/15",
    iconRing: "ring-indigo-500/30",
    iconRingHover: "group-hover:ring-indigo-500/60",
    iconText: "text-indigo-300",
    badgeBg: "bg-indigo-500/20",
    badgeText: "text-indigo-300",
    badgeBorder: "border-indigo-500/30",
    radialFrom: "from-indigo-900/30",
    stepGradient: "from-indigo-400 to-indigo-600",
    stepShadow: "shadow-indigo-500/30",
    connectorFrom: "from-indigo-500/50",
    connectorVia: "via-indigo-500/30",
    withHeaderText: "text-indigo-300",
    withHeaderBg: "bg-indigo-500/5",
    hoverStripVia: "via-indigo-500/60",
    hoverGlowBg: "bg-indigo-500/10",
    statsGlowBg: "bg-indigo-500/10",
    ctaBorder: "border-indigo-500/30",
    ctaFromBg: "from-indigo-900/40",
    ctaToBg: "to-indigo-900/30",
    ctaButtonShadow: "shadow-indigo-500/20",
    ctaButtonShadowHover: "hover:shadow-indigo-500/30",
  },
  violet: {
    iconBg: "bg-violet-500/15",
    iconRing: "ring-violet-500/30",
    iconRingHover: "group-hover:ring-violet-500/60",
    iconText: "text-violet-300",
    badgeBg: "bg-violet-500/20",
    badgeText: "text-violet-300",
    badgeBorder: "border-violet-500/30",
    radialFrom: "from-violet-900/30",
    stepGradient: "from-violet-400 to-violet-600",
    stepShadow: "shadow-violet-500/30",
    connectorFrom: "from-violet-500/50",
    connectorVia: "via-violet-500/30",
    withHeaderText: "text-violet-300",
    withHeaderBg: "bg-violet-500/5",
    hoverStripVia: "via-violet-500/60",
    hoverGlowBg: "bg-violet-500/10",
    statsGlowBg: "bg-violet-500/10",
    ctaBorder: "border-violet-500/30",
    ctaFromBg: "from-violet-900/40",
    ctaToBg: "to-violet-900/30",
    ctaButtonShadow: "shadow-violet-500/20",
    ctaButtonShadowHover: "hover:shadow-violet-500/30",
  },
  blue: {
    iconBg: "bg-blue-500/15",
    iconRing: "ring-blue-500/30",
    iconRingHover: "group-hover:ring-blue-500/60",
    iconText: "text-blue-300",
    badgeBg: "bg-blue-500/20",
    badgeText: "text-blue-300",
    badgeBorder: "border-blue-500/30",
    radialFrom: "from-blue-900/30",
    stepGradient: "from-blue-400 to-blue-600",
    stepShadow: "shadow-blue-500/30",
    connectorFrom: "from-blue-500/50",
    connectorVia: "via-blue-500/30",
    withHeaderText: "text-blue-300",
    withHeaderBg: "bg-blue-500/5",
    hoverStripVia: "via-blue-500/60",
    hoverGlowBg: "bg-blue-500/10",
    statsGlowBg: "bg-blue-500/10",
    ctaBorder: "border-blue-500/30",
    ctaFromBg: "from-blue-900/40",
    ctaToBg: "to-blue-900/30",
    ctaButtonShadow: "shadow-blue-500/20",
    ctaButtonShadowHover: "hover:shadow-blue-500/30",
  },
};
