"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TalokLogoProps {
  /** "light" = texte sombre sur fond clair, "dark" = texte blanc sur fond sombre */
  variant?: "light" | "dark";
  /** Taille du logo */
  size?: "sm" | "md" | "lg";
  /** Desactiver le lien vers l'accueil */
  noLink?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: "h-6 w-6", text: "text-base", iconInner: "h-3.5 w-3.5" },
  md: { icon: "h-8 w-8", text: "text-lg", iconInner: "h-5 w-5" },
  lg: { icon: "h-10 w-10", text: "text-xl", iconInner: "h-6 w-6" },
};

export function TalokLogo({ variant = "dark", size = "md", noLink = false, className }: TalokLogoProps) {
  const s = SIZE_MAP[size];

  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center",
          s.icon
        )}
      >
        <Building2 className={cn("text-white", s.iconInner)} />
      </span>
      <span
        className={cn(
          "font-bold tracking-tight",
          s.text,
          variant === "dark" ? "text-white" : "text-foreground"
        )}
      >
        Talok
      </span>
    </span>
  );

  if (noLink) return content;

  return (
    <Link href="/" className="inline-flex items-center hover:opacity-90 transition-opacity">
      {content}
    </Link>
  );
}

export default TalokLogo;
