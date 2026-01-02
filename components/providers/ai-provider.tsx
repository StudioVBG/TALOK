"use client";

/**
 * AI Provider - Fournit les composants AI globaux
 * SOTA 2026 - Architecture AI-First
 * 
 * Ce provider ajoute :
 * - La Command Palette AI (⌘K)
 * - Le bouton flottant Copilot
 */

import { ReactNode } from "react";
import { AICommandPalette } from "@/components/ai/ai-command-palette";
import { AICopilotButton } from "@/components/ai/ai-copilot-button";
import { useAICommandStore } from "@/lib/hooks/use-ai-command";

interface AIProviderProps {
  children: ReactNode;
  /**
   * Afficher le bouton flottant Copilot
   * @default true
   */
  showCopilotButton?: boolean;
  /**
   * Désactiver l'assistant AI
   * @default false
   */
  disabled?: boolean;
}

export function AIProvider({
  children,
  showCopilotButton = true,
  disabled = false,
}: AIProviderProps) {
  const { isOpen, setOpen } = useAICommandStore();

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Command Palette - accessible via ⌘K */}
      <AICommandPalette open={isOpen} onOpenChange={setOpen} />

      {/* Bouton flottant Copilot */}
      {showCopilotButton && <AICopilotButton variant="floating" />}
    </>
  );
}

export default AIProvider;

