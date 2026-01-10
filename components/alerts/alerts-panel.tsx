"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, AlertTriangle, Calendar, FileWarning, TrendingUp, 
  Shield, X, ChevronRight, ExternalLink, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Types
type AlertPriority = "low" | "medium" | "high" | "critical";
type AlertType = 
  | "unpaid_rent"
  | "lease_ending"
  | "diagnostic_expiring"
  | "rent_revision"
  | "insurance_expiring";

interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  actionUrl?: string;
  actionLabel?: string;
  dueDate?: string;
  amount?: number;
  createdAt: string;
  readAt?: string;
}

// Configuration des types d'alertes
const alertTypeConfig: Record<AlertType, {
  icon: typeof AlertTriangle;
  label: string;
  color: string;
}> = {
  unpaid_rent: {
    icon: AlertTriangle,
    label: "Loyer impayé",
    color: "text-red-500",
  },
  lease_ending: {
    icon: Calendar,
    label: "Fin de bail",
    color: "text-orange-500",
  },
  diagnostic_expiring: {
    icon: FileWarning,
    label: "Diagnostic",
    color: "text-yellow-500",
  },
  rent_revision: {
    icon: TrendingUp,
    label: "Révision loyer",
    color: "text-blue-500",
  },
  insurance_expiring: {
    icon: Shield,
    label: "Assurance",
    color: "text-purple-500",
  },
};

const priorityConfig: Record<AlertPriority, {
  label: string;
  variant: "destructive" | "default" | "secondary" | "outline";
  bgClass: string;
}> = {
  critical: {
    label: "Critique",
    variant: "destructive",
    bgClass: "bg-red-500/10 border-red-500/20",
  },
  high: {
    label: "Haute",
    variant: "destructive",
    bgClass: "bg-orange-500/10 border-orange-500/20",
  },
  medium: {
    label: "Moyenne",
    variant: "default",
    bgClass: "bg-yellow-500/10 border-yellow-500/20",
  },
  low: {
    label: "Basse",
    variant: "secondary",
    bgClass: "bg-blue-500/10 border-blue-500/20",
  },
};

interface AlertItemProps {
  alert: Alert;
  onDismiss?: (id: string) => void;
  onMarkRead?: (id: string) => void;
}

function AlertItem({ alert, onDismiss, onMarkRead }: AlertItemProps) {
  const typeConfig = alertTypeConfig[alert.type];
  const priority = priorityConfig[alert.priority];
  const Icon = typeConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        "p-4 rounded-lg border transition-colors",
        priority.bgClass,
        !alert.readAt && "ring-1 ring-inset ring-current/10"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5", typeConfig.color)}>
          <Icon className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{alert.title}</span>
            <Badge variant={priority.variant} className="text-xs">
              {priority.label}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2">
            {alert.message}
          </p>
          
          {alert.dueDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Échéance : {new Date(alert.dueDate).toLocaleDateString("fr-FR")}
            </p>
          )}
          
          {alert.amount && (
            <p className="text-sm font-medium mt-1">
              {alert.amount.toLocaleString("fr-FR")} €
            </p>
          )}
          
          <div className="flex items-center gap-2 mt-3">
            {alert.actionUrl && (
              <Link href={alert.actionUrl}>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  {alert.actionLabel || "Voir"}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            )}
            
            {!alert.readAt && onMarkRead && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => onMarkRead(alert.id)}
              >
                <Check className="mr-1 h-3 w-3" />
                Lu
              </Button>
            )}
            
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => onDismiss(alert.id)}
              >
                <X className="mr-1 h-3 w-3" />
                Ignorer
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface AlertsPanelProps {
  alerts: Alert[];
  onDismiss?: (id: string) => void;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
}

export function AlertsPanel({ 
  alerts, 
  onDismiss, 
  onMarkRead,
  onMarkAllRead 
}: AlertsPanelProps) {
  const unreadCount = alerts.filter(a => !a.readAt).length;
  const criticalCount = alerts.filter(a => a.priority === "critical").length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Alertes (${unreadCount} non lues)` : "Alertes"}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                "absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium text-white",
                criticalCount > 0 ? "bg-red-500" : "bg-primary"
              )}
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertes
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}</Badge>
              )}
            </SheetTitle>
            
            {unreadCount > 0 && onMarkAllRead && (
              <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
                Tout marquer lu
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Aucune alerte pour le moment
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {alerts.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onDismiss={onDismiss}
                    onMarkRead={onMarkRead}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Composant de résumé des alertes pour le dashboard
export function AlertsSummary({ alerts }: { alerts: Alert[] }) {
  const criticalAlerts = alerts.filter(a => a.priority === "critical");
  const highAlerts = alerts.filter(a => a.priority === "high");
  
  if (alerts.length === 0) return null;

  return (
    <Card className={cn(
      "border-l-4",
      criticalAlerts.length > 0 ? "border-l-red-500" : 
      highAlerts.length > 0 ? "border-l-orange-500" : "border-l-yellow-500"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {alerts.length} alerte{alerts.length > 1 ? "s" : ""} en attente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert) => {
            const typeConfig = alertTypeConfig[alert.type];
            const Icon = typeConfig.icon;
            
            return (
              <div key={alert.id} className="flex items-center gap-2 text-sm">
                <Icon className={cn("h-4 w-4", typeConfig.color)} />
                <span className="truncate">{alert.title}</span>
                {alert.actionUrl && (
                  <Link href={alert.actionUrl} className="ml-auto">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                )}
              </div>
            );
          })}
          
          {alerts.length > 3 && (
            <p className="text-xs text-muted-foreground pt-1">
              + {alerts.length - 3} autre{alerts.length - 3 > 1 ? "s" : ""} alerte{alerts.length - 3 > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default AlertsPanel;

