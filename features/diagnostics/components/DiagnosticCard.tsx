"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Flame,
  Zap,
  Bug,
  Shield,
  AlertTriangle,
  Ruler,
  Volume2,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { DiagnosticType, PropertyDiagnostic } from "@/lib/validations/diagnostics";
import { DIAGNOSTIC_SHORT_LABELS } from "@/lib/validations/diagnostics";
import { DPERatingBadge } from "./DPERatingBadge";
import { ExpiryAlert } from "./ExpiryAlert";

const ICONS: Record<DiagnosticType, React.ReactNode> = {
  dpe: <Zap className="h-5 w-5" />,
  amiante: <Shield className="h-5 w-5" />,
  plomb: <Shield className="h-5 w-5" />,
  gaz: <Flame className="h-5 w-5" />,
  electricite: <Zap className="h-5 w-5" />,
  termites: <Bug className="h-5 w-5" />,
  erp: <AlertTriangle className="h-5 w-5" />,
  surface_boutin: <Ruler className="h-5 w-5" />,
  bruit: <Volume2 className="h-5 w-5" />,
};

const ICON_COLORS: Record<DiagnosticType, string> = {
  dpe: "bg-blue-100 text-blue-600",
  amiante: "bg-purple-100 text-purple-600",
  plomb: "bg-orange-100 text-orange-600",
  gaz: "bg-red-100 text-red-600",
  electricite: "bg-yellow-100 text-yellow-700",
  termites: "bg-green-100 text-green-600",
  erp: "bg-amber-100 text-amber-600",
  surface_boutin: "bg-indigo-100 text-indigo-600",
  bruit: "bg-teal-100 text-teal-600",
};

function getStatus(diag: PropertyDiagnostic): "valid" | "expired" | "expiring" {
  if (!diag.expiry_date) return "valid";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(diag.expiry_date);
  if (expiry < today) return "expired";
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 60) return "expiring";
  return "valid";
}

interface DiagnosticCardProps {
  diagnostic: PropertyDiagnostic;
  onEdit?: (diag: PropertyDiagnostic) => void;
}

export function DiagnosticCard({ diagnostic, onEdit }: DiagnosticCardProps) {
  const type = diagnostic.diagnostic_type as DiagnosticType;
  const label = DIAGNOSTIC_SHORT_LABELS[type] ?? type;
  const status = getStatus(diagnostic);

  return (
    <Card className={`overflow-hidden border-slate-200 shadow-sm ${status === "expired" ? "border-red-200" : status === "expiring" ? "border-amber-200" : ""}`}>
      <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${ICON_COLORS[type] ?? "bg-slate-100 text-slate-500"}`}>
              {ICONS[type] ?? <FileText className="h-5 w-5" />}
            </div>
            <CardTitle className="text-base">{label}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={status === "valid" ? "default" : "destructive"}
              className={
                status === "valid"
                  ? "bg-emerald-500"
                  : status === "expiring"
                    ? "bg-amber-500"
                    : ""
              }
            >
              {status === "valid" ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Valide</>
              ) : status === "expiring" ? (
                <><Clock className="h-3 w-3 mr-1" /> Bientôt expiré</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Expiré</>
              )}
            </Badge>
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(diagnostic)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {type === "dpe" && diagnostic.result && (
          <DPERatingBadge rating={diagnostic.result} size="md" label={`Classe ${diagnostic.result}`} />
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground uppercase font-semibold">Réalisé le</span>
            <p className="font-medium">
              {format(new Date(diagnostic.performed_date), "dd MMM yyyy", { locale: fr })}
            </p>
          </div>
          {diagnostic.expiry_date && (
            <div>
              <span className="text-xs text-muted-foreground uppercase font-semibold">Expire le</span>
              <p className={`font-medium ${status === "expired" ? "text-red-600" : status === "expiring" ? "text-amber-600" : "text-emerald-600"}`}>
                {format(new Date(diagnostic.expiry_date), "dd MMM yyyy", { locale: fr })}
              </p>
            </div>
          )}
        </div>

        {diagnostic.diagnostiqueur_name && (
          <div className="text-sm">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Diagnostiqueur</span>
            <p className="font-medium">{diagnostic.diagnostiqueur_name}</p>
          </div>
        )}

        {diagnostic.result && type !== "dpe" && (
          <div className="text-sm">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Résultat</span>
            <Badge variant="outline" className="ml-2 capitalize">{diagnostic.result}</Badge>
          </div>
        )}

        <ExpiryAlert
          expiryDate={diagnostic.expiry_date}
          label={label}
        />
      </CardContent>
    </Card>
  );
}

interface DiagnosticPlaceholderCardProps {
  type: DiagnosticType;
  required: boolean;
  reason: string;
  onAdd?: () => void;
}

export function DiagnosticPlaceholderCard({
  type,
  required,
  reason,
  onAdd,
}: DiagnosticPlaceholderCardProps) {
  const label = DIAGNOSTIC_SHORT_LABELS[type] ?? type;

  return (
    <Card className={`overflow-hidden border-dashed ${required ? "border-amber-300 bg-amber-50/30" : "border-slate-200 opacity-70"}`}>
      <CardContent className="py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${ICON_COLORS[type] ?? "bg-slate-100 text-slate-500"} ${required ? "" : "opacity-50"}`}>
              {ICONS[type] ?? <FileText className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{reason}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {required && (
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                Requis
              </Badge>
            )}
            {onAdd && (
              <Button size="sm" variant={required ? "default" : "outline"} onClick={onAdd}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ajouter
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
