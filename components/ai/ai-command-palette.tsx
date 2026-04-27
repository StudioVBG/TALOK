"use client";

/**
 * AI Command Palette - Interface principale AI-First
 * SOTA 2026 - Interaction naturelle par commandes
 * 
 * Opened programmatically via useAICommand store (⌘K handled by CommandPalette)
 * Combine recherche rapide et chat avec l'assistant Tom
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useChat } from "ai/react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEntityStore } from "@/stores/useEntityStore";
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

// Suggestions dédiées au mode TALO Compta (substituées en contexte
// /accounting/*). Volontairement orientées chiffres réels de l'entité —
// l'agent backend a accès à la balance et aux écritures de l'exercice.
const ACCT_SUGGESTIONS = [
  "Quelle est ma balance globale ?",
  "Quelles sont mes plus grosses charges cette année ?",
  "Combien de loyers impayés ?",
  "Mon résultat foncier prévisionnel ?",
  "Quel est mon top 3 des dépenses ?",
];

// ============================================
// COMPONENT
// ============================================

interface AICommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================
// ACCOUNTING CONTEXT ROUTING (Option A unifiée)
// ============================================
//
// Sur les pages /*/accounting/*, l'agent générique Tom (/api/assistant/stream)
// laisse place à TALO Compta (/api/accounting/agent/chat), qui dispose d'un
// RAG sur les écritures de l'entité + contexte balance/KPIs. Le composant
// reste UNIQUE — c'est le path qui pilote le backend, pas un nouveau widget.
//
// Le backend TALO est non-streaming (renvoie un JSON envelope), incompatible
// avec useChat de la SDK Vercel. On maintient donc un état de messages
// parallèle pour ce mode et on branche le form submit selon le pathname.

interface AcctMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function isAccountingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // Couvre owner, agency, syndic, admin
  return /\/accounting(\/|$)/.test(pathname);
}

export function AICommandPalette({ open, onOpenChange }: AICommandPaletteProps) {
  const [mode, setMode] = useState<PaletteMode>("search");
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Détection du contexte comptable (palette ouverte sur une page /accounting/*).
  const pathname = usePathname();
  const isAcctContext = useMemo(() => isAccountingPath(pathname), [pathname]);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);

  // Exercice ouvert pour l'entité active — fetché à la demande quand la
  // palette s'ouvre en contexte compta. Évite de pré-charger pour rien sur
  // les autres pages.
  const [acctExerciseId, setAcctExerciseId] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !isAcctContext || !activeEntityId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/accounting/exercises?entityId=${encodeURIComponent(activeEntityId)}`,
        );
        const json = await res.json();
        const exs: Array<{ id: string; status?: string }> =
          json?.data?.exercises ?? json?.data ?? [];
        const open_ = exs.find((e) => e.status === "open") ?? exs[0];
        if (!cancelled) setAcctExerciseId(open_?.id ?? null);
      } catch {
        if (!cancelled) setAcctExerciseId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isAcctContext, activeEntityId]);

  // État parallèle dédié à TALO compta (non-streaming).
  const [acctMessages, setAcctMessages] = useState<AcctMessage[]>([]);
  const [acctLoading, setAcctLoading] = useState(false);
  const [acctError, setAcctError] = useState<string | null>(null);

  // Chat générique (Tom) — inchangé.
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

  // Vues unifiées : la suite du composant lit ces 4 valeurs, peu importe le mode.
  const displayMessages = isAcctContext ? acctMessages : messages;
  const displayIsLoading = isAcctContext ? acctLoading : isLoading;
  const displayError = isAcctContext
    ? acctError
      ? { message: acctError }
      : null
    : error;
  const displayReload = isAcctContext
    ? () => {
        // En mode compta, "reload" relance la dernière question utilisateur.
        const lastUser = [...acctMessages].reverse().find((m) => m.role === "user");
        if (lastUser) void submitAccounting(lastUser.content);
      }
    : reload;

  async function submitAccounting(question: string) {
    if (!activeEntityId || !acctExerciseId) {
      setAcctError(
        "Aucun exercice comptable ouvert pour l'entité active. Sélectionnez une entité ou créez un exercice.",
      );
      return;
    }
    const trimmed = question.trim();
    if (trimmed.length < 3) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAcctMessages((prev) => [
      ...prev,
      { id, role: "user", content: trimmed },
    ]);
    setAcctLoading(true);
    setAcctError(null);
    try {
      const res = await fetch("/api/accounting/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: activeEntityId,
          exerciseId: acctExerciseId,
          question: trimmed,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error ?? `Erreur ${res.status}`);
      }
      setAcctMessages((prev) => [
        ...prev,
        {
          id: `${id}-r`,
          role: "assistant",
          content: json?.data?.answer ?? "Pas de réponse.",
        },
      ]);
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    } catch (e) {
      setAcctError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setAcctLoading(false);
    }
  }

  // Note: ⌘K shortcut is handled by CommandPalette (per-role search palette).
  // AICommandPalette is opened programmatically via the Zustand store (useAICommand).

  // Reset au close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setMode("search");
        setInputValue("");
        setInput("");
        setAcctMessages([]);
        setAcctError(null);
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

  // Form submit — branché sur TALO compta si on est sur une page /accounting/*,
  // sinon sur l'agent générique Tom (useChat).
  const onFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed || displayIsLoading) return;
      setMode("chat");
      if (isAcctContext) {
        void submitAccounting(trimmed);
        setInputValue("");
        setInput("");
      } else {
        handleSubmit(e);
        setInputValue("");
      }
    },
    [inputValue, displayIsLoading, isAcctContext, handleSubmit, setInput],
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
              placeholder={
                isAcctContext
                  ? "Pose une question sur ta compta… (balance, loyers, charges)"
                  : "Demande à Tom... (ex: loyers en retard, révision bail...)"
              }
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={displayIsLoading}
            />
            {inputValue.trim() && (
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="shrink-0"
                disabled={displayIsLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
          {displayIsLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          )}
          <Badge variant="outline" className="text-xs shrink-0">
            {isAcctContext
              ? "📊 TALO Compta"
              : mode === "chat"
                ? "💬 Chat"
                : "⚡ Actions"}
          </Badge>
        </div>

        {/* Contenu */}
        <ScrollArea ref={scrollRef} className="flex-1">
          <AnimatePresence mode="wait">
            {/* Mode recherche - Actions rapides */}
            {mode === "search" && displayMessages.length === 0 && (
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

                  {/* Actions rapides Tom (génériques) — masquées en mode TALO compta
                      car les prompts ne s'appliquent pas (loyers impayés, tickets, etc.
                      relèvent du domaine produit, pas comptable). */}
                  {!isAcctContext && (
                    <>
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
                    </>
                  )}

                  <CommandGroup
                    heading={
                      isAcctContext ? "📊 Questions comptabilité" : "💡 Suggestions"
                    }
                  >
                    {(isAcctContext ? ACCT_SUGGESTIONS : SUGGESTIONS)
                      .slice(0, isAcctContext ? 5 : 3)
                      .map((suggestion, i) => (
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
            {(mode === "chat" || displayMessages.length > 0) && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 space-y-4"
              >
                {/* Messages */}
                {displayMessages.map((message, i) => (
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
                {displayIsLoading && (
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
                          {isAcctContext ? "TALO" : "Tom"} réfléchit...
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Error */}
                {displayError && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Erreur</p>
                        <p className="text-xs mt-1">{displayError.message}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => displayReload()}
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
          {displayMessages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={() => {
                setMode("search");
                if (isAcctContext) {
                  setAcctMessages([]);
                  setAcctError(null);
                }
                // Clear pour le mode générique reste un TODO côté useChat
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

