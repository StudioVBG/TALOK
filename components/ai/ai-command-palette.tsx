"use client";

/**
 * AI Command Palette - Interface principale AI-First
 * SOTA 2026 - Interaction naturelle par commandes
 * 
 * Accessible via ⌘K / Ctrl+K
 * Combine recherche rapide et chat avec l'assistant Tom
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useChat } from "ai/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Home,
  FileText,
  Wrench,
  DollarSign,
  Users,
  Calendar,
  AlertTriangle,
  Send,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "query" | "action" | "navigation";
  prompt?: string;
  href?: string;
}

type PaletteMode = "search" | "chat";

// ============================================
// QUICK ACTIONS
// ============================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "unpaid-rents",
    label: "Loyers impayés",
    description: "Voir tous les loyers en retard",
    icon: <DollarSign className="h-4 w-4 text-red-500" />,
    category: "query",
    prompt: "Montre-moi tous les loyers en retard avec les montants et les locataires concernés",
  },
  {
    id: "open-tickets",
    label: "Tickets ouverts",
    description: "Voir les demandes de maintenance en cours",
    icon: <Wrench className="h-4 w-4 text-orange-500" />,
    category: "query",
    prompt: "Quels tickets de maintenance sont ouverts ? Donne-moi les détails et la priorité",
  },
  {
    id: "expiring-leases",
    label: "Baux expirant",
    description: "Baux arrivant à échéance prochainement",
    icon: <FileText className="h-4 w-4 text-yellow-500" />,
    category: "query",
    prompt: "Quels baux arrivent à échéance dans les 3 prochains mois ? Que dois-je faire ?",
  },
  {
    id: "portfolio-summary",
    label: "Résumé patrimoine",
    description: "Vue d'ensemble de vos biens",
    icon: <Home className="h-4 w-4 text-blue-500" />,
    category: "query",
    prompt: "Fais-moi un résumé complet de mon patrimoine immobilier avec les chiffres clés",
  },
  {
    id: "tenant-list",
    label: "Mes locataires",
    description: "Liste de tous vos locataires",
    icon: <Users className="h-4 w-4 text-green-500" />,
    category: "query",
    prompt: "Liste tous mes locataires avec leurs informations de contact et leur bail",
  },
  {
    id: "calendar-events",
    label: "Événements à venir",
    description: "Échéances et rendez-vous",
    icon: <Calendar className="h-4 w-4 text-purple-500" />,
    category: "query",
    prompt: "Quels sont les événements importants à venir ? (fin de bail, révision loyer, etc.)",
  },
];

const SUGGESTIONS = [
  "Comment réviser le loyer d'un bail ?",
  "Quelles sont mes obligations de propriétaire ?",
  "Quel est le délai de préavis pour un locataire ?",
  "Comment faire un état des lieux de sortie ?",
  "Que faire en cas d'impayé de loyer ?",
];

// ============================================
// COMPONENT
// ============================================

interface AICommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AICommandPalette({ open, onOpenChange }: AICommandPaletteProps) {
  const [mode, setMode] = useState<PaletteMode>("search");
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Chat avec l'assistant
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
  } = useChat({
    api: "/api/assistant/stream",
    onFinish: () => {
      // Scroll vers le bas après réponse
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    },
  });

  // Raccourci clavier global
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Reset au close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setMode("search");
        setInputValue("");
        setInput("");
      }, 200);
    }
  }, [open, setInput]);

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Sync input values
  useEffect(() => {
    setInput(inputValue);
  }, [inputValue, setInput]);

  // Exécuter une action rapide
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (action.href) {
        window.location.href = action.href;
        onOpenChange(false);
      } else if (action.prompt) {
        setInputValue(action.prompt);
        setMode("chat");
        // Soumettre automatiquement après un court délai
        setTimeout(() => {
          const form = document.querySelector(
            "[data-ai-form]"
          ) as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        }, 100);
      }
    },
    [onOpenChange]
  );

  // Soumettre une suggestion
  const handleSuggestion = useCallback(
    (suggestion: string) => {
      setInputValue(suggestion);
      setMode("chat");
      setTimeout(() => {
        const form = document.querySelector("[data-ai-form]") as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }, 100);
    },
    []
  );

  // Détection du mode (recherche vs question)
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);

      const questionIndicators = [
        "comment",
        "pourquoi",
        "quand",
        "où",
        "qui",
        "quel",
        "quels",
        "quelle",
        "quelles",
        "combien",
        "est-ce",
        "montre",
        "affiche",
        "liste",
        "fais",
        "crée",
        "génère",
        "explique",
        "aide",
        "peux-tu",
        "?",
      ];

      const isQuestion = questionIndicators.some(
        (indicator) =>
          value.toLowerCase().includes(indicator) || value.includes("?")
      );

      setMode(isQuestion || value.length > 30 ? "chat" : "search");
    },
    []
  );

  // Form submit
  const onFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) {
        setMode("chat");
        handleSubmit(e);
        setInputValue("");
      }
    },
    [inputValue, isLoading, handleSubmit]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col max-h-[80vh] min-h-[400px]">
        {/* Header avec input */}
        <div className="flex items-center border-b px-3 gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <form
            data-ai-form
            onSubmit={onFormSubmit}
            className="flex-1 flex items-center"
          >
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Demande à Tom... (ex: loyers en retard, révision bail...)"
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            />
            {inputValue.trim() && (
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="shrink-0"
                disabled={isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          )}
          <Badge variant="outline" className="text-xs shrink-0">
            {mode === "chat" ? "💬 Chat" : "⚡ Actions"}
          </Badge>
        </div>

        {/* Contenu */}
        <ScrollArea ref={scrollRef} className="flex-1">
          <AnimatePresence mode="wait">
            {/* Mode recherche - Actions rapides */}
            {mode === "search" && messages.length === 0 && (
              <motion.div
                key="quick-actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <CommandList>
                  <CommandEmpty>
                    <div className="text-center py-6">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Pose une question ou choisis une action
                      </p>
                    </div>
                  </CommandEmpty>

                  <CommandGroup heading="⚡ Actions rapides">
                    {QUICK_ACTIONS.map((action) => (
                      <CommandItem
                        key={action.id}
                        onSelect={() => handleQuickAction(action)}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                          {action.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{action.label}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {action.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandSeparator />

                  <CommandGroup heading="💡 Suggestions">
                    {SUGGESTIONS.slice(0, 3).map((suggestion, i) => (
                      <CommandItem
                        key={i}
                        onSelect={() => handleSuggestion(suggestion)}
                        className="px-4 py-2 cursor-pointer"
                      >
                        <BookOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{suggestion}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </motion.div>
            )}

            {/* Mode chat - Conversation */}
            {(mode === "chat" || messages.length > 0) && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 space-y-4"
              >
                {/* Messages */}
                {messages.map((message, i) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </motion.div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Tom réfléchit...
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Erreur</p>
                        <p className="text-xs mt-1">{error.message}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reload()}
                        className="shrink-0"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px] font-mono">
                ↵
              </kbd>{" "}
              envoyer
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px] font-mono">
                ⌘K
              </kbd>{" "}
              ouvrir
            </span>
          </div>
          {messages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={() => {
                setMode("search");
                // Clear messages would need to be added to useChat
              }}
            >
              Nouvelle conversation
            </Button>
          )}
        </div>
      </div>
    </CommandDialog>
  );
}

export default AICommandPalette;

