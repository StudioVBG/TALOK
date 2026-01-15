"use client";

import { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ShortcutInfo {
  keys: string[];
  description: string;
  category?: string;
}

const shortcuts: ShortcutInfo[] = [
  // Navigation
  { keys: ["⌘", "K"], description: "Ouvrir la recherche rapide", category: "Navigation" },
  { keys: ["⌘", "D"], description: "Tableau de bord", category: "Navigation" },
  { keys: ["⌘", "B"], description: "Mes biens", category: "Navigation" },
  { keys: ["⌘", "L"], description: "Mes locataires", category: "Navigation" },
  { keys: ["⌘", "C"], description: "Mes contrats", category: "Navigation" },
  { keys: ["⌘", "M"], description: "Mes finances", category: "Navigation" },
  
  // Actions
  { keys: ["⌘", "⇧", "N"], description: "Nouveau bien", category: "Actions" },
  { keys: ["⌘", "T"], description: "Changer le thème", category: "Actions" },
  
  // Général
  { keys: ["?"], description: "Afficher cette aide", category: "Général" },
  { keys: ["Esc"], description: "Fermer la modale", category: "Général" },
];

interface KeyboardShortcutsHelpProps {
  className?: string;
  triggerVariant?: "icon" | "button";
}

export function KeyboardShortcutsHelp({
  className,
  triggerVariant = "icon",
}: KeyboardShortcutsHelpProps) {
  const [open, setOpen] = useState(false);

  // Raccourci ? pour ouvrir l'aide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        const activeElement = document.activeElement;
        const tagName = activeElement?.tagName.toLowerCase();
        if (tagName !== "input" && tagName !== "textarea") {
          e.preventDefault();
          setOpen(true);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Grouper par catégorie
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || "Autre";
    if (!acc[category]) acc[category] = [];
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutInfo[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-9 w-9", className)}
            aria-label="Raccourcis clavier"
          >
            <Keyboard className="h-4 w-4" />
            <span className="sr-only">Raccourcis clavier</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={className}>
            <Keyboard className="h-4 w-4 mr-2" />
            Raccourcis
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Raccourcis clavier
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {category}
              </h4>
              <div className="space-y-2">
                {items.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border shadow-sm min-w-[24px] text-center"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Appuyez sur <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">?</kbd> pour afficher cette aide
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsHelp;

