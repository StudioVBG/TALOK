"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  RefreshCw,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  CreditCard,
  Key,
  Eye,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/helpers/format";
import { useAuditLogs } from "@/lib/hooks/use-admin-queries";

interface AuditLog {
  id: string;
  user_id: string;
  profile_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  user_agent?: string;
  risk_level: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, unknown>;
  success: boolean;
  error_message?: string;
  created_at: string;
}

const RISK_COLORS: Record<string, { bg: string; text: string; icon: typeof Info }> = {
  low: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", icon: Info },
  medium: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: AlertCircle },
  high: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", icon: AlertTriangle },
  critical: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", icon: Shield },
};

const ENTITY_ICONS: Record<string, typeof User> = {
  admin_action: Shield,
  profile: User,
  iban: CreditCard,
  identity_document: FileText,
  api_key: Key,
  subscription: CreditCard,
  payment: CreditCard,
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const perPage = 30;

  const { data, isLoading: loading, refetch: fetchLogs } = useAuditLogs({
    limit: perPage,
    offset: (page - 1) * perPage,
    risk_level: riskFilter,
    entity_type: entityFilter,
    user_id: search || undefined,
  });

  const logs: AuditLog[] = (data?.logs as AuditLog[]) || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPage);

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ["Date", "Action", "Entity", "Risk", "User ID", "IP", "Success"];
    const rows = logs.map((l) => [
      l.created_at,
      l.action,
      l.entity_type,
      l.risk_level,
      l.user_id,
      l.ip_address || "",
      l.success ? "OK" : "FAIL",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Journal d'audit</h1>
          <p className="text-muted-foreground">
            Historique des actions sensibles sur la plateforme
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchLogs()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrer par User ID..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Niveau risque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous niveaux</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
                <SelectItem value="high">Haut</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="low">Bas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type d'entite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="admin_action">Actions admin</SelectItem>
                <SelectItem value="profile">Profils</SelectItem>
                <SelectItem value="iban">IBAN</SelectItem>
                <SelectItem value="identity_document">Documents ID</SelectItem>
                <SelectItem value="subscription">Abonnements</SelectItem>
                <SelectItem value="payment">Paiements</SelectItem>
                <SelectItem value="api_key">Cles API</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["critical", "high", "medium", "low"] as const).map((level) => {
          const config = RISK_COLORS[level];
          const Icon = config.icon;
          const count = logs.filter((l) => l.risk_level === level).length;
          return (
            <div
              key={level}
              className={cn("p-3 rounded-lg flex items-center gap-3", config.bg)}
            >
              <Icon className={cn("h-5 w-5", config.text)} />
              <div>
                <p className={cn("text-lg font-bold", config.text)}>{count}</p>
                <p className="text-xs text-muted-foreground capitalize">{level}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Liste des logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {total} evenement{total > 1 ? "s" : ""}
          </CardTitle>
          <CardDescription>
            Page {page} sur {totalPages || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun log d'audit trouve</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const riskConfig = RISK_COLORS[log.risk_level] || RISK_COLORS.low;
                const RiskIcon = riskConfig.icon;
                const EntityIcon = ENTITY_ICONS[log.entity_type] || FileText;

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                      "hover:bg-muted/50",
                      !log.success && "border-red-200 dark:border-red-800/50"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg shrink-0", riskConfig.bg)}>
                      <EntityIcon className={cn("h-4 w-4", riskConfig.text)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{log.action}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {log.entity_type.replace(/_/g, " ")}
                        </Badge>
                        <Badge className={cn("text-xs", riskConfig.bg, riskConfig.text)}>
                          <RiskIcon className="h-3 w-3 mr-1" />
                          {log.risk_level}
                        </Badge>
                        {!log.success && (
                          <Badge variant="destructive" className="text-xs">
                            Echec
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDateShort(log.created_at)}</span>
                        {log.ip_address && <span>IP: {log.ip_address}</span>}
                        <span className="truncate max-w-[200px]" title={log.user_id}>
                          User: {log.user_id.slice(0, 8)}...
                        </span>
                      </div>

                      {log.metadata?.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {String(log.metadata.description)}
                        </p>
                      )}

                      {log.error_message && (
                        <p className="text-xs text-red-500 mt-1">
                          Erreur: {log.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {total} evenement{total > 1 ? "s" : ""} au total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
