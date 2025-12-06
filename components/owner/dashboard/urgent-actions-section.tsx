"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  FileSignature,
  Euro,
  Wrench,
  Calendar,
  ArrowRight,
  Clock,
  Bell,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/helpers/format";

interface UrgentAction {
  id: string;
  type: "signature" | "payment" | "ticket" | "lease_end" | "inspection" | "document";
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  link: string;
  linkLabel?: string;
  metadata?: {
    amount?: number;
    daysLeft?: number;
    count?: number;
  };
}

interface UrgentActionsSectionProps {
  actions: UrgentAction[];
}

const typeConfig = {
  signature: {
    icon: FileSignature,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    borderColor: "border-l-amber-500",
  },
  payment: {
    icon: Euro,
    color: "text-red-600",
    bgColor: "bg-red-100",
    borderColor: "border-l-red-500",
  },
  ticket: {
    icon: Wrench,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    borderColor: "border-l-orange-500",
  },
  lease_end: {
    icon: Calendar,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    borderColor: "border-l-purple-500",
  },
  inspection: {
    icon: Clock,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    borderColor: "border-l-blue-500",
  },
  document: {
    icon: Bell,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    borderColor: "border-l-slate-500",
  },
};

const priorityConfig = {
  critical: {
    badge: "bg-red-500 text-white",
    label: "Urgent",
    ring: "ring-2 ring-red-200",
  },
  high: {
    badge: "bg-amber-500 text-white",
    label: "Important",
    ring: "ring-1 ring-amber-200",
  },
  medium: {
    badge: "bg-blue-500 text-white",
    label: "À traiter",
    ring: "",
  },
};

function UrgentActionCard({ action, index }: { action: UrgentAction; index: number }) {
  const config = typeConfig[action.type];
  const priority = priorityConfig[action.priority];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={action.link}>
        <Card
          className={cn(
            "group border-l-4 hover:shadow-lg transition-all duration-200 hover:scale-[1.01] cursor-pointer",
            config.borderColor,
            priority.ring
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Icône */}
              <div className={cn("p-2.5 rounded-xl shrink-0", config.bgColor)}>
                <Icon className={cn("h-5 w-5", config.color)} />
              </div>

              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-slate-900 truncate">
                    {action.title}
                  </h4>
                  {action.priority === "critical" && (
                    <Badge className={priority.badge} variant="secondary">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {priority.label}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 line-clamp-1">
                  {action.description}
                </p>
                
                {/* Métadonnées */}
                {action.metadata && (
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    {action.metadata.amount !== undefined && (
                      <span className="font-semibold text-red-600">
                        {formatCurrency(action.metadata.amount)}
                      </span>
                    )}
                    {action.metadata.daysLeft !== undefined && (
                      <span className={cn(
                        "font-medium",
                        action.metadata.daysLeft <= 7 ? "text-red-600" :
                        action.metadata.daysLeft <= 30 ? "text-amber-600" : "text-slate-500"
                      )}>
                        <Clock className="h-3 w-3 inline mr-1" />
                        {action.metadata.daysLeft}j restants
                      </span>
                    )}
                    {action.metadata.count !== undefined && action.metadata.count > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        {action.metadata.count} éléments
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Action */}
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {action.linkLabel || "Traiter"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

export function UrgentActionsSection({ actions }: UrgentActionsSectionProps) {
  // Trier par priorité
  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const criticalCount = actions.filter((a) => a.priority === "critical").length;
  const highCount = actions.filter((a) => a.priority === "high").length;

  if (actions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="py-8 text-center">
            <div className="inline-flex items-center justify-center p-4 bg-emerald-100 rounded-full mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-emerald-900 mb-2">
              Tout est à jour !
            </h3>
            <p className="text-sm text-emerald-700">
              Aucune action urgente en attente. Votre gestion locative est au top !
            </p>
            <div className="flex items-center justify-center gap-1 mt-4 text-emerald-600">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Félicitations</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header avec compteurs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Actions urgentes
          </h2>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="font-bold">
                {criticalCount} critique{criticalCount > 1 ? "s" : ""}
              </Badge>
            )}
            {highCount > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                {highCount} important{highCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
        <span className="text-sm text-slate-500">
          {actions.length} action{actions.length > 1 ? "s" : ""} en attente
        </span>
      </div>

      {/* Liste des actions */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {sortedActions.map((action, index) => (
            <UrgentActionCard key={action.id} action={action} index={index} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export type { UrgentAction };

