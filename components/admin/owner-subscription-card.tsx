"use client";

/**
 * OwnerSubscriptionCard - SOTA 2025
 * Carte d'abonnement premium avec glassmorphism, animations, et actions admin
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Crown,
  Zap,
  Sparkles,
  Gift,
  Edit3,
  ExternalLink,
  Home,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Loader2,
  Shield,
  Star,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface OwnerSubscription {
  id: string;
  plan_slug: string;
  plan_name: string;
  status: string;
  billing_cycle: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  properties_count: number;
  leases_count: number;
  max_properties: number;
  max_leases: number;
  max_tenants: number;
  price_monthly: number;
  price_yearly: number;
  created_at: string;
}

interface OwnerSubscriptionCardProps {
  ownerId: string;
  ownerUserId: string;
  ownerEmail: string | null;
  subscription: OwnerSubscription | null;
  onUpdate?: () => void;
}

// ============================================
// CONFIGURATION
// ============================================

const PLAN_THEMES: Record<string, {
  gradient: string;
  glow: string;
  icon: React.ElementType;
  badge: string;
  ring: string;
  iconColor: string;
}> = {
  starter: {
    gradient: "from-slate-500/20 via-slate-400/10 to-slate-600/20",
    glow: "shadow-slate-500/10",
    icon: Shield,
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    ring: "ring-slate-400/30",
    iconColor: "text-slate-600",
  },
  confort: {
    gradient: "from-blue-500/20 via-cyan-400/10 to-blue-600/20",
    glow: "shadow-blue-500/20",
    icon: Star,
    badge: "bg-blue-100 text-blue-700 border-blue-300",
    ring: "ring-blue-400/30",
    iconColor: "text-blue-600",
  },
  pro: {
    gradient: "from-violet-500/20 via-purple-400/10 to-violet-600/20",
    glow: "shadow-violet-500/25",
    icon: Rocket,
    badge: "bg-violet-100 text-violet-700 border-violet-300",
    ring: "ring-violet-400/30",
    iconColor: "text-violet-600",
  },
  enterprise: {
    gradient: "from-amber-500/20 via-orange-400/10 to-amber-600/20",
    glow: "shadow-amber-500/25",
    icon: Crown,
    badge: "bg-amber-100 text-amber-700 border-amber-300",
    ring: "ring-amber-400/30",
    iconColor: "text-amber-600",
  },
};

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: React.ElementType;
  pulse?: boolean;
}> = {
  active: {
    label: "Actif",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    icon: CheckCircle2,
  },
  trialing: {
    label: "Essai",
    color: "bg-blue-100 text-blue-700 border-blue-300",
    icon: Clock,
    pulse: true,
  },
  past_due: {
    label: "Impayé",
    color: "bg-red-100 text-red-700 border-red-300",
    icon: AlertTriangle,
    pulse: true,
  },
  canceled: {
    label: "Annulé",
    color: "bg-gray-100 text-gray-600 border-gray-300",
    icon: Ban,
  },
  paused: {
    label: "Suspendu",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    icon: AlertTriangle,
  },
  incomplete: {
    label: "Incomplet",
    color: "bg-orange-100 text-orange-700 border-orange-300",
    icon: AlertTriangle,
  },
};

// ============================================
// HELPERS
// ============================================

function formatPrice(cents: number, cycle?: string | null): string {
  if (cents === 0) return "Gratuit";
  const euros = cents / 100;
  return cycle === "yearly" ? `${euros}€/an` : `${euros}€/mois`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDaysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ============================================
// SUB-COMPONENTS
// ============================================

function UsageBar({
  label,
  used,
  max,
  icon: Icon,
}: {
  label: string;
  used: number;
  max: number;
  icon: React.ElementType;
}) {
  const isUnlimited = max === -1;
  const percent = isUnlimited ? 15 : Math.min(100, (used / Math.max(1, max)) * 100);
  const isNearLimit = !isUnlimited && percent >= 80;
  const isAtLimit = !isUnlimited && percent >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className={cn(
          "font-medium tabular-nums",
          isAtLimit && "text-red-600",
          isNearLimit && !isAtLimit && "text-amber-600"
        )}>
          {used} / {isUnlimited ? "∞" : max}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            isAtLimit
              ? "bg-gradient-to-r from-red-500 to-red-600"
              : isNearLimit
              ? "bg-gradient-to-r from-amber-500 to-amber-600"
              : "bg-gradient-to-r from-emerald-500 to-emerald-600"
          )}
        />
      </div>
    </div>
  );
}

function PlanChangeDialog({
  open,
  onOpenChange,
  currentPlan,
  ownerUserId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
  ownerUserId: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = React.useState(currentPlan);
  const [reason, setReason] = React.useState("");
  const [notifyUser, setNotifyUser] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedPlan(currentPlan);
      setReason("");
    }
  }, [open, currentPlan]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: "Raison requise",
        description: "Veuillez indiquer une raison pour ce changement.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/subscriptions/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: ownerUserId,
          target_plan: selectedPlan,
          reason,
          notify_user: notifyUser,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors du changement");
      }

      toast({
        title: "✅ Forfait modifié",
        description: `Passage vers ${selectedPlan.toUpperCase()} effectué.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Modifier le forfait
          </DialogTitle>
          <DialogDescription>
            Cette action sera enregistrée dans l'historique admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Plan Selection */}
          <div className="space-y-2">
            <Label>Nouveau forfait</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-500" />
                    <span>Starter — 9€/mois</span>
                  </div>
                </SelectItem>
                <SelectItem value="confort">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-blue-500" />
                    <span>Confort — 29€/mois</span>
                  </div>
                </SelectItem>
                <SelectItem value="pro">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-violet-500" />
                    <span>Pro — 59€/mois</span>
                  </div>
                </SelectItem>
                <SelectItem value="enterprise">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span>Enterprise — Sur devis</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Raison du changement *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Upgrade commercial, geste commercial, demande support..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Notify switch */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="notify" className="cursor-pointer">
                Notifier l'utilisateur
              </Label>
              <p className="text-xs text-muted-foreground">
                Envoyer un email de confirmation
              </p>
            </div>
            <Switch
              id="notify"
              checked={notifyUser}
              onCheckedChange={setNotifyUser}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedPlan === currentPlan}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function OwnerSubscriptionCard({
  ownerId,
  ownerUserId,
  ownerEmail,
  subscription,
  onUpdate,
}: OwnerSubscriptionCardProps) {
  const [changeDialogOpen, setChangeDialogOpen] = React.useState(false);
  
  const theme = PLAN_THEMES[subscription?.plan_slug || "starter"] || PLAN_THEMES.starter;
  const statusConfig = STATUS_CONFIG[subscription?.status || "active"] || STATUS_CONFIG.active;
  const PlanIcon = theme.icon;
  const StatusIcon = statusConfig.icon;

  const trialDaysRemaining = subscription?.trial_end
    ? getDaysRemaining(subscription.trial_end)
    : null;

  // No subscription state
  if (!subscription) {
    return (
      <Card className="border-2 border-dashed border-muted-foreground/20 bg-muted/5">
        <CardContent className="py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Aucun abonnement</p>
              <p className="text-sm text-muted-foreground/70">
                Ce compte n'a pas d'abonnement configuré
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChangeDialogOpen(true)}
            >
              <Zap className="mr-2 h-4 w-4" />
              Créer un abonnement
            </Button>
          </motion.div>
        </CardContent>
        <PlanChangeDialog
          open={changeDialogOpen}
          onOpenChange={setChangeDialogOpen}
          currentPlan="starter"
          ownerUserId={ownerUserId}
          onSuccess={() => onUpdate?.()}
        />
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className={cn(
            "relative overflow-hidden border-0",
            "bg-gradient-to-br",
            theme.gradient,
            "backdrop-blur-sm",
            "shadow-lg",
            theme.glow,
            "hover:shadow-xl transition-shadow duration-300"
          )}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <CardHeader className="relative pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  className={cn(
                    "p-2.5 rounded-xl bg-white/80 shadow-sm",
                    `ring-2 ${theme.ring}`
                  )}
                >
                  <PlanIcon className={cn("h-5 w-5", theme.iconColor)} />
                </motion.div>
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    {subscription.plan_name}
                    {subscription.plan_slug === "enterprise" && (
                      <Sparkles className="h-4 w-4 text-amber-500" />
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-medium">
                    {formatPrice(
                      subscription.billing_cycle === "yearly"
                        ? subscription.price_yearly
                        : subscription.price_monthly,
                      subscription.billing_cycle
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 font-medium",
                    statusConfig.color,
                    statusConfig.pulse && "animate-pulse"
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>

                {/* Edit button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setChangeDialogOpen(true)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Modifier le forfait</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative space-y-4">
            {/* Trial warning */}
            <AnimatePresence>
              {subscription.status === "trialing" && trialDaysRemaining !== null && trialDaysRemaining > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700"
                >
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">
                    {trialDaysRemaining} jour{trialDaysRemaining > 1 ? "s" : ""} d'essai restant{trialDaysRemaining > 1 ? "s" : ""}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cancel warning */}
            <AnimatePresence>
              {subscription.cancel_at_period_end && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700"
                >
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">
                    Annulation prévue le {formatDate(subscription.current_period_end)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Usage stats */}
            <div className="space-y-3 p-3 rounded-xl bg-white/40 dark:bg-black/20">
              <UsageBar
                label="Biens"
                used={subscription.properties_count}
                max={subscription.max_properties}
                icon={Home}
              />
              <UsageBar
                label="Baux"
                used={subscription.leases_count}
                max={subscription.max_leases}
                icon={FileText}
              />
            </div>

            {/* Period info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white/30 dark:bg-black/10">
                <span className="text-muted-foreground block mb-0.5">Cycle</span>
                <span className="font-medium">
                  {subscription.billing_cycle === "yearly" ? "Annuel" : "Mensuel"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/30 dark:bg-black/10">
                <span className="text-muted-foreground block mb-0.5">Prochaine échéance</span>
                <span className="font-medium">
                  {subscription.current_period_end
                    ? formatDate(subscription.current_period_end)
                    : "—"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-white/50 hover:bg-white/80"
                onClick={() =>
                  window.open(
                    `/admin/subscriptions?search=${encodeURIComponent(ownerEmail || "")}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Voir détails
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/50 hover:bg-white/80"
                    onClick={() => setChangeDialogOpen(true)}
                  >
                    <Gift className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Offrir jours / Upgrade</TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Change Plan Dialog */}
      <PlanChangeDialog
        open={changeDialogOpen}
        onOpenChange={setChangeDialogOpen}
        currentPlan={subscription.plan_slug}
        ownerUserId={ownerUserId}
        onSuccess={() => onUpdate?.()}
      />
    </TooltipProvider>
  );
}

