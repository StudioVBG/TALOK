import type { LucideIcon } from "lucide-react";

export type SolutionTheme = {
  /** Tailwind gradient `from-X to-Y` colors used for hero h1 + CTA */
  gradient: string;
  /** Tailwind solid color name (e.g. "emerald", "orange", "sky") */
  accent: "emerald" | "orange" | "sky" | "indigo" | "violet" | "blue";
  /** Hex used by Sparkles particles */
  sparkleColor: string;
};

export type SolutionStat = {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  icon: LucideIcon;
};

export type SolutionPainPoint = {
  icon: LucideIcon;
  title: string;
  solution: string;
};

export type SolutionStep = {
  title: string;
  desc: string;
  icon: LucideIcon;
};

export type SolutionFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type SolutionComparisonRow = {
  topic: string;
  without: string;
  with: string;
};

export type SolutionFAQItem = {
  question: string;
  answer: string;
};

export type SolutionTestimonial = {
  quote: string;
  author: string;
  location: string;
  context: string;
};
