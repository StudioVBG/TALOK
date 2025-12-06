"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites, type FavoriteType } from "@/lib/hooks/use-favorites";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FavoriteButtonProps {
  /** ID de l'élément */
  id: string;
  /** Type d'élément */
  type: FavoriteType;
  /** Label pour le favori (affiché dans la liste) */
  label: string;
  /** Description optionnelle */
  description?: string;
  /** URL de redirection */
  href: string;
  /** Taille du bouton */
  size?: "sm" | "default" | "lg" | "icon";
  /** Variante */
  variant?: "ghost" | "outline" | "default";
  /** Classes additionnelles */
  className?: string;
  /** Afficher le texte */
  showLabel?: boolean;
}

export function FavoriteButton({
  id,
  type,
  label,
  description,
  href,
  size = "icon",
  variant = "ghost",
  className,
  showLabel = false,
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const isActive = isFavorite(id, type);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite({ id, type, label, description, href });
  };

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(
        "transition-all duration-200",
        isActive && "text-amber-500 hover:text-amber-600",
        className
      )}
    >
      <Star
        className={cn(
          "h-4 w-4 transition-all",
          isActive && "fill-amber-500"
        )}
      />
      {showLabel && (
        <span className="ml-2">
          {isActive ? "Retirer des favoris" : "Ajouter aux favoris"}
        </span>
      )}
    </Button>
  );

  if (showLabel) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>{isActive ? "Retirer des favoris" : "Ajouter aux favoris"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default FavoriteButton;

