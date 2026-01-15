"use client";

import Link from "next/link";
import { Star, Building2, FileText, Users, Ticket, File, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFavorites, type FavoriteType } from "@/lib/hooks/use-favorites";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const typeIcons: Record<FavoriteType, typeof Building2> = {
  property: Building2,
  lease: FileText,
  tenant: Users,
  document: File,
  ticket: Ticket,
};

const typeLabels: Record<FavoriteType, string> = {
  property: "Bien",
  lease: "Bail",
  tenant: "Locataire",
  document: "Document",
  ticket: "Ticket",
};

interface FavoritesListProps {
  className?: string;
}

export function FavoritesList({ className }: FavoritesListProps) {
  const { favorites, removeFavorite, count } = useFavorites();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label="Mes favoris"
        >
          <Star className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          Mes favoris ({count})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {count === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Aucun favori</p>
            <p className="text-xs">Cliquez sur ⭐ pour ajouter des éléments</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {favorites.map((item) => {
              const Icon = typeIcons[item.type];
              return (
                <DropdownMenuItem
                  key={`${item.type}-${item.id}`}
                  className="flex items-start gap-3 p-3 cursor-pointer group"
                  asChild
                >
                  <Link href={item.href}>
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.label}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                          {typeLabels[item.type]}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(item.addedAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFavorite(item.id, item.type);
                      }}
                      aria-label="Retirer des favoris"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FavoritesList;

