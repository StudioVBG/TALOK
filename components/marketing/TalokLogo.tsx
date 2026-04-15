"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface TalokLogoProps {
  /** Conservé pour compatibilité API — le logo horizontal intègre son propre badge, fonctionne sur fond clair & sombre */
  variant?: "light" | "dark";
  /** Taille du logo (hauteur) */
  size?: "sm" | "md" | "lg";
  /** Desactiver le lien vers l'accueil */
  noLink?: boolean;
  className?: string;
}

const SIZE_CLS = {
  sm: "h-8 w-auto",
  md: "h-10 w-auto",
  lg: "h-14 w-auto",
};

export function TalokLogo({ size = "md", noLink = false, className }: TalokLogoProps) {
  const content = (
    <Image
      src="/images/talok-logo-horizontal.png"
      alt="TALOK"
      width={160}
      height={64}
      className={cn("object-contain", SIZE_CLS[size], className)}
      priority
    />
  );

  if (noLink) return content;

  return (
    <Link href="/" className="inline-flex items-center hover:opacity-90 transition-opacity">
      {content}
    </Link>
  );
}

export default TalokLogo;
