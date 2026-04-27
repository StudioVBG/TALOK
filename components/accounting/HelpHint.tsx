/**
 * Petit indicateur "?" cliquable pour expliquer un concept comptable.
 *
 * Deux modes selon la longueur du contenu :
 *
 *  - **tooltip court** : passer `tooltip="..."`. Affiché au hover/focus.
 *    Pour des concepts qui se résument en 1-2 phrases.
 *
 *  - **popover détaillé** : passer `title` + `description` (string ou
 *    ReactNode). S'ouvre au clic. Pour des explications structurées
 *    (plusieurs paragraphes, listes, références juridiques).
 *
 * Auto-suffisant : embarque son propre TooltipProvider, pas besoin de
 * wrapper le layout. Accessible : icône cachée à AT (aria-hidden) +
 * sr-only label porté par le bouton.
 */

"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type CommonProps = {
  /** Label vocal lu par les AT, ex. "Aide sur la balance générale". */
  ariaLabel?: string;
  /** Classe sur le bouton wrapper (taille/positionnement). */
  className?: string;
};

type TooltipMode = CommonProps & {
  tooltip: string;
  title?: never;
  description?: never;
};

type PopoverMode = CommonProps & {
  tooltip?: never;
  title: string;
  description: React.ReactNode;
};

export type HelpHintProps = TooltipMode | PopoverMode;

export function HelpHint(props: HelpHintProps) {
  const ariaLabel = props.ariaLabel ?? "Plus d'informations";

  // Mode tooltip court : hover/focus.
  if ("tooltip" in props && props.tooltip) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={ariaLabel}
              className={cn(
                "inline-flex items-center justify-center text-muted-foreground/70 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full",
                props.className,
              )}
            >
              <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="sr-only">{ariaLabel}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-relaxed">
            {props.tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Mode popover détaillé : clic.
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground/70 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full",
            props.className,
          )}
        >
          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="sr-only">{ariaLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-sm text-sm" side="top" align="start">
        <h4 className="font-semibold text-foreground mb-1.5">
          {(props as PopoverMode).title}
        </h4>
        <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
          {(props as PopoverMode).description}
        </div>
      </PopoverContent>
    </Popover>
  );
}
