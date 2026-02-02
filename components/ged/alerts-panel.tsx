"use client";
// @ts-nocheck

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpiryBadge } from "./expiry-badge";
import {
  AlertTriangle, XCircle, Clock, Upload, ChevronRight,
  Bell, CheckCircle2,
} from "lucide-react";
import { DOCUMENT_TYPES } from "@/lib/owner/constants";
import type { DocumentAlertsSummary, ExpiryStatus } from "@/lib/types/ged";

interface AlertsPanelProps {
  summary: DocumentAlertsSummary | undefined;
  isLoading: boolean;
  onUploadNew?: (documentType: string) => void;
  onViewDocument?: (documentId: string) => void;
  className?: string;
}

export function AlertsPanel({
  summary,
  isLoading,
  onUploadNew,
  onViewDocument,
  className,
}: AlertsPanelProps) {
  if (isLoading) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const totalAlerts =
    summary.expired_count +
    summary.expiring_soon_count +
    summary.expiring_notice_count;

  if (totalAlerts === 0) {
    return (
      <Card className={cn("border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10", className)}>
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            Tous vos documents sont à jour
          </p>
        </CardContent>
      </Card>
    );
  }

  // Grouper les alertes par niveau de sévérité
  const expired = summary.alert_documents.filter(d => d.expiry_status === "expired");
  const expiringSoon = summary.alert_documents.filter(d => d.expiry_status === "expiring_soon");
  const expiringNotice = summary.alert_documents.filter(d => d.expiry_status === "expiring_notice");

  return (
    <Card className={cn("border-amber-200/50 dark:border-amber-800/50", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Alertes documents
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {summary.expired_count > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {summary.expired_count} expiré{summary.expired_count > 1 ? "s" : ""}
              </Badge>
            )}
            {summary.expiring_soon_count > 0 && (
              <Badge className="text-xs px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                {summary.expiring_soon_count} urgent{summary.expiring_soon_count > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Expired documents */}
        {expired.length > 0 && (
          <AlertSection
            title="Documents expirés"
            icon={<XCircle className="h-4 w-4 text-rose-500" />}
            items={expired}
            onUploadNew={onUploadNew}
            onViewDocument={onViewDocument}
          />
        )}

        {/* Expiring soon (30 days) */}
        {expiringSoon.length > 0 && (
          <AlertSection
            title="Expirent dans 30 jours"
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            items={expiringSoon}
            onUploadNew={onUploadNew}
            onViewDocument={onViewDocument}
          />
        )}

        {/* Expiring notice (90 days) */}
        {expiringNotice.length > 0 && (
          <AlertSection
            title="A renouveler (90 jours)"
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            items={expiringNotice}
            onUploadNew={onUploadNew}
            onViewDocument={onViewDocument}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AlertSection({
  title,
  icon,
  items,
  onUploadNew,
  onViewDocument,
}: {
  title: string;
  icon: React.ReactNode;
  items: DocumentAlertsSummary["alert_documents"];
  onUploadNew?: (documentType: string) => void;
  onViewDocument?: (documentId: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {icon}
        {title}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-2 p-2.5 rounded-md border bg-background hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {item.title ||
                  (DOCUMENT_TYPES as Record<string, string>)[item.type] ||
                  item.type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ExpiryBadge
              status={item.expiry_status}
              daysUntilExpiry={item.days_until_expiry}
            />
            {onUploadNew && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => onUploadNew(item.type)}
              >
                <Upload className="h-3 w-3" /> Remplacer
              </Button>
            )}
            {onViewDocument && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onViewDocument(item.id)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
