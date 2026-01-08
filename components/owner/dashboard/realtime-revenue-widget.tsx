"use client";

/**
 * SOTA 2026 - Widget Revenus Temps Réel
 * Affiche les revenus avec mise à jour en temps réel
 */

import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeDashboard } from "@/lib/hooks/use-realtime-dashboard";
import { formatCurrency } from "@/lib/helpers/format";
import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Euro,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  WifiOff,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function RealtimeRevenueWidget() {
  const {
    totalRevenue,
    pendingPayments,
    latePayments,
    recentEvents,
    isConnected,
    lastUpdate,
    loading,
  } = useRealtimeDashboard({ showToasts: true });

  if (loading) {
    return (
      <GlassCard className="p-6">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-12 w-48 mb-2" />
        <Skeleton className="h-4 w-24" />
      </GlassCard>
    );
  }

  return (
    <GlassCard gradient className="p-6 relative overflow-hidden">
      {/* Indicateur de connexion temps réel */}
      <div className="absolute top-4 right-4">
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 text-xs",
            isConnected
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          )}
        >
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3" />
              Live
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              Hors ligne
            </>
          )}
        </Badge>
      </div>

      {/* En-tête */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-emerald-100 rounded-xl">
          <Euro className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Revenus du mois</h3>
          <p className="text-xs text-slate-500">
            Mise à jour en temps réel
          </p>
        </div>
      </div>

      {/* Montant principal avec animation */}
      <div className="mb-6">
        <motion.div
          key={totalRevenue}
          initial={{ scale: 1.05, color: "#10b981" }}
          animate={{ scale: 1, color: "#1e293b" }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-bold text-slate-900"
        >
          <AnimatedCounter value={totalRevenue} type="currency" />
        </motion.div>
        {lastUpdate && (
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Mis à jour {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: fr })}
          </p>
        )}
      </div>

      {/* Stats secondaires */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-amber-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">En attente</span>
          </div>
          <p className="text-xl font-bold text-amber-900">{pendingPayments}</p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-red-700">En retard</span>
          </div>
          <p className="text-xl font-bold text-red-900">{latePayments}</p>
        </div>
      </div>

      {/* Événements récents */}
      <AnimatePresence mode="popLayout">
        {recentEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-100 pt-4"
          >
            <h4 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Activité récente
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {recentEvents.slice(0, 3).map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <div
                    className={cn(
                      "p-1 rounded-full",
                      event.type === "payment" && "bg-emerald-100 text-emerald-600",
                      event.type === "signature" && "bg-blue-100 text-blue-600",
                      event.type === "ticket" && "bg-amber-100 text-amber-600"
                    )}
                  >
                    {event.type === "payment" && <CheckCircle2 className="h-3 w-3" />}
                    {event.type === "signature" && <CheckCircle2 className="h-3 w-3" />}
                    {event.type === "ticket" && <AlertTriangle className="h-3 w-3" />}
                  </div>
                  <span className="text-slate-700 truncate flex-1">{event.title}</span>
                  <span className="text-xs text-slate-400">
                    {formatDistanceToNow(event.timestamp, { addSuffix: true, locale: fr })}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

// Widget compact pour la barre latérale ou header
export function RealtimeStatusIndicator() {
  const { isConnected, lastUpdate, loading } = useRealtimeDashboard();

  if (loading) return null;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
        )}
      />
      <span className="text-xs text-slate-500">
        {isConnected ? "Temps réel" : "Déconnecté"}
      </span>
    </div>
  );
}

// Export du hook pour utilisation externe
export { useRealtimeDashboard } from "@/lib/hooks/use-realtime-dashboard";

