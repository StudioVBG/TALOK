"use client";

import Link from "next/link";
import Image from "next/image";
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
  sm: { img: "h-7 w-7", text: "text-base" },
  md: { img: "h-9 w-9", text: "text-lg" },
  lg: { img: "h-12 w-12", text: "text-xl" },
};

export function TalokLogo({ variant = "dark", size = "md", noLink = false, className }: TalokLogoProps) {
  const s = SIZE_MAP[size];

  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/images/talok-icon.png"
        alt="TALOK"
        width={48}
        height={48}
        className={cn("object-contain rounded-lg", s.img)}
      />
      <span
        className={cn(
          "font-bold tracking-tight",
          s.text,
          variant === "dark" ? "text-white" : "text-foreground"
        )}
      >
        TALOK
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
