"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DIAGNOSTIC_SHORT_LABELS, type DiagnosticType } from "@/lib/validations/diagnostics";

interface ChecklistItem {
  type: DiagnosticType;
  label: string;
  required: boolean;
  reason: string;
  status: "missing" | "valid" | "expired";
  performed_date: string | null;
  expiry_date: string | null;
}

interface RequiredDiagnosticsCheckerProps {
  propertyId: string;
  /** Compact mode for embedding in other forms (e.g. lease wizard) */
  compact?: boolean;
  /** Called with the readiness status */
  onStatusChange?: (allValid: boolean) => void;
}

export function RequiredDiagnosticsChecker({
  propertyId,
  compact = false,
  onStatusChange,
}: RequiredDiagnosticsCheckerProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/diagnostics/check-required", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property_id: propertyId }),
        });
        if (res.ok) {
          const data = await res.json();
          setChecklist(data.checklist ?? []);
        }
      } catch (err) {
        console.error("Error checking required diagnostics:", err);
      } finally {
        setLoading(false);
      }
    }
    check();
  }, [propertyId]);

  useEffect(() => {
    if (!loading && onStatusChange) {
      const requiredItems = checklist.filter((c) => c.required);
      const allValid = requiredItems.every((c) => c.status === "valid");
      onStatusChange(allValid);
    }
  }, [checklist, loading, onStatusChange]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Vérification des diagnostics...</span>
      </div>
    );
  }

  const requiredItems = checklist.filter((c) => c.required);
  const validCount = requiredItems.filter((c) => c.status === "valid").length;
  const allValid = validCount === requiredItems.length;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {allValid ? (
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-sm font-medium">
            DDT : {validCount}/{requiredItems.length} diagnostics conformes
          </span>
        </div>
        <div className="space-y-1">
          {requiredItems.map((item) => (
            <div key={item.type} className="flex items-center gap-2 text-xs">
              {item.status === "valid" ? (
                <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : item.status === "expired" ? (
                <XCircle className="h-3 w-3 text-red-500 shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-slate-300 shrink-0" />
              )}
              <span className={item.status === "valid" ? "text-slate-600" : "text-slate-900 font-medium"}>
                {DIAGNOSTIC_SHORT_LABELS[item.type]}
              </span>
              {item.status === "expired" && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">Expiré</Badge>
              )}
              {item.status === "missing" && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-300">Manquant</Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className={allValid ? "border-emerald-200" : "border-amber-200"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${allValid ? "text-emerald-500" : "text-amber-500"}`} />
            <CardTitle className="text-base">Conformité DDT</CardTitle>
          </div>
          <Badge variant={allValid ? "default" : "secondary"} className={allValid ? "bg-emerald-500" : "bg-amber-100 text-amber-700"}>
            {validCount}/{requiredItems.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {requiredItems.map((item) => (
          <div
            key={item.type}
            className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"
          >
            <div className="flex items-center gap-2">
              {item.status === "valid" ? (
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : item.status === "expired" ? (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-slate-300 shrink-0" />
              )}
              <span className="text-sm">{DIAGNOSTIC_SHORT_LABELS[item.type]}</span>
            </div>
            <Badge
              variant={item.status === "valid" ? "default" : item.status === "expired" ? "destructive" : "outline"}
              className={`text-xs ${item.status === "valid" ? "bg-emerald-500" : ""}`}
            >
              {item.status === "valid" ? "Valide" : item.status === "expired" ? "Expiré" : "Manquant"}
            </Badge>
          </div>
        ))}

        {!allValid && (
          <p className="text-xs text-amber-600 mt-3 p-2 bg-amber-50 rounded">
            Certains diagnostics obligatoires sont manquants ou expirés. La création de bail pourrait être bloquée.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
