"use client";

/**
 * UnifiedFAB - SOTA 2026
 * FAB unifié pour mobile qui remplace les multiples boutons flottants
 * - Position adaptée à la bottom nav sur mobile
 * - Menu expandable avec actions contextuelles
 * - Intégration Assistant IA + Upgrade
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { 
  Sparkles, 
  Crown, 
  MessageCircle, 
  X, 
  HelpCircle,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UpgradeModal } from "@/components/subscription/upgrade-modal";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { PLANS, type PlanSlug } from "@/lib/subscriptions/plans";

interface UnifiedFABProps {
  className?: string;
}

export function UnifiedFAB({ className }: UnifiedFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const pathname = usePathname();
  const { currentPlan } = useSubscription();

  const getUpgradeTarget = (): { plan: PlanSlug; label: string } | null => {
    if (pathname?.startsWith("/owner/providers")) {
      return { plan: "pro", label: `Passer ${PLANS.pro.name}` };
    }

    if (pathname?.startsWith("/owner/inspections")) {
      return { plan: "confort", label: `Passer ${PLANS.confort.name}` };
    }

    if (pathname?.startsWith("/owner/settings/branding")) {
      return { plan: "enterprise_m", label: `Passer ${PLANS.enterprise_m.name}` };
    }

    const planOrder: PlanSlug[] = [
      "gratuit",
      "starter",
      "confort",
      "pro",
      "enterprise_s",
      "enterprise_m",
      "enterprise_l",
      "enterprise_xl",
    ];
    const currentIndex = planOrder.indexOf(currentPlan);
    const nextPlan = planOrder[currentIndex + 1];

    return nextPlan ? { plan: nextPlan, label: `Passer ${PLANS[nextPlan].name}` } : null;
  };

  const upgradeTarget = getUpgradeTarget();

  // Fermer le menu si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = () => {
      if (isOpen) setIsOpen(false);
    };

    if (isOpen) {
      // Petit délai pour éviter de fermer immédiatement
      const timer = setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Raccourci clavier Cmd+J pour ouvrir l'assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setShowAssistant(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const menuItems = [
    {
      id: "assistant",
      label: "Assistant IA",
      icon: MessageCircle,
      gradient: "from-violet-600 to-indigo-600",
      onClick: () => {
        setShowAssistant(true);
        setIsOpen(false);
      },
    },
    upgradeTarget ? {
      id: "upgrade",
      label: upgradeTarget.label,
      icon: Crown,
      gradient: "from-amber-500 to-orange-500",
      onClick: () => {
        setShowUpgrade(true);
        setIsOpen(false);
      },
    } : null,
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    icon: typeof MessageCircle;
    gradient: string;
    onClick: () => void;
  }>;

  return (
    <>
      {/* Container du FAB - Position adaptée mobile vs desktop */}
      <div 
        className={cn(
          // Mobile: au-dessus de la bottom nav (h-14 + safe area + margin)
          "fixed z-40",
          "bottom-[calc(theme(spacing.16)+env(safe-area-inset-bottom)+theme(spacing.4))]",
          "right-4",
          // Desktop: position classique
          "lg:bottom-6 lg:right-6",
          className
        )}
      >
        {/* Menu expandable */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="absolute bottom-16 right-0 flex flex-col gap-2 items-end"
              onClick={(e) => e.stopPropagation()}
            >
              {menuItems.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={item.onClick}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full",
                    "text-white shadow-lg shadow-black/20",
                    "bg-gradient-to-r",
                    item.gradient,
                    "touch-target" // Minimum 44px pour accessibilité
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bouton principal FAB */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={cn(
            "w-14 h-14 rounded-full shadow-xl",
            "flex items-center justify-center",
            "bg-gradient-to-r from-violet-600 to-indigo-600",
            "transition-all duration-200",
            "touch-target", // Accessibilité
            isOpen && "rotate-45"
          )}
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu d'actions"}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {isOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <Sparkles className="w-6 h-6 text-white" />
            )}
          </motion.div>
        </motion.button>

        {/* Badge raccourci clavier - Desktop only */}
        <div className="hidden lg:block absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 0.7, y: 0 }}
            className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-white rounded"
          >
            ⌘J
          </motion.div>
        </div>
      </div>

      {/* Panel Assistant IA (Sheet) */}
      <AssistantPanelControlled 
        open={showAssistant} 
        onOpenChange={setShowAssistant} 
      />

      {/* Modal Upgrade */}
      <UpgradeModal 
        open={showUpgrade} 
        onClose={() => setShowUpgrade(false)} 
        requiredPlan={upgradeTarget?.plan}
      />
    </>
  );
}

/**
 * Version contrôlée de l'AssistantPanel
 * SOTA 2026: Sheet contrôlé externalement pour intégration UnifiedFAB
 */
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Loader2, 
  Bot, 
  User,
  Clock,
  AlertCircle
} from "lucide-react";

function AssistantPanelControlled({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = [
    "Montre-moi mes propriétés",
    "Résumé des loyers ce mois",
    "Y a-t-il des tickets ouverts ?",
    "Génère une quittance"
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erreur de communication');
      }

      setMessages(prev => [...prev, {
        id: data.messageId || crypto.randomUUID(),
        role: 'assistant',
        content: data.response || data.content || 'Désolé, je n\'ai pas pu répondre.',
        timestamp: new Date()
      }]);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[440px] p-0 flex flex-col bg-background/95 backdrop-blur-sm"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg">Tom Assistant</SheetTitle>
              <SheetDescription className="text-xs">
                IA • Votre assistant personnel
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-600/20 to-indigo-600/20 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-violet-600" />
              </div>
              <h3 className="font-semibold mb-2">Comment puis-je vous aider ?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Je peux rechercher vos biens, locataires, paiements et plus encore.
              </p>
              
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                {suggestions.map((suggestion, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 px-3 justify-start"
                    onClick={() => {
                      setInput(suggestion);
                      setTimeout(() => handleSubmit(), 100);
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 items-start"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
            <p className="text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          </div>
        )}

        {/* Input Area - Avec safe area */}
        <div className="p-4 pb-safe border-t bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default UnifiedFAB;

