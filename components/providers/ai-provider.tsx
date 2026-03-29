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
import dynamic from "next/dynamic";
import { useAICommandStore } from "@/lib/hooks/use-ai-command";

// Dynamic imports avec ssr:false pour éviter le crash si ai/react ne résout pas zod
const AICommandPalette = dynamic(
  () => import("@/components/ai/ai-command-palette").then((m) => m.AICommandPalette),
  { ssr: false }
);
const AICopilotButton = dynamic(
  () => import("@/components/ai/ai-copilot-button").then((m) => m.AICopilotButton),
  { ssr: false }
);

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
