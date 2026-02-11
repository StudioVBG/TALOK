"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  Clock,
  CheckCircle,
  FileText,
  ExternalLink,
  ArrowRight,
  Camera,
  Key,
  Calendar,
  AlertTriangle,
  Loader2,
  Plus,
} from "lucide-react";

interface EdlData {
  id: string;
  status: string;
  type: string;
  scheduled_at?: string | null;
  completed_date?: string | null;
}

interface LeaseEdlTabProps {
  leaseId: string;
  propertyId: string;
  leaseStatus: string;
  edl: EdlData | null;
  hasSignedEdl: boolean;
}

const EDL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: FileText },
  scheduled: { label: "Planifié", color: "bg-blue-100 text-blue-700", icon: Calendar },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700", icon: Loader2 },
  completed: { label: "Complété", color: "bg-indigo-100 text-indigo-700", icon: CheckCircle },
  signed: { label: "Signé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  disputed: { label: "Contesté", color: "bg-red-100 text-red-700", icon: AlertTriangle },
};

export function LeaseEdlTab({ leaseId, propertyId, leaseStatus, edl, hasSignedEdl }: LeaseEdlTabProps) {
  const router = useRouter();

  // Bail pas encore signé : EDL non disponible
  const bailNotReady = !["fully_signed", "active", "notice_given", "terminated", "archived"].includes(leaseStatus);

  if (bailNotReady) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="p-4 bg-slate-100 rounded-full mb-4">
          <ClipboardCheck className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">
          État des lieux non disponible
        </h3>
        <p className="text-sm text-slate-500 text-center max-w-md">
          L&apos;état des lieux d&apos;entrée sera disponible une fois que le bail aura été signé par toutes les parties.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          En attente de la signature du bail
        </div>
      </div>
    );
  }

  // Bail signé mais pas d'EDL encore : proposer la création
  if (!edl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-12 px-4"
      >
        <div className="p-4 bg-indigo-100 rounded-full mb-4">
          <ClipboardCheck className="h-8 w-8 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Créer l&apos;état des lieux d&apos;entrée
        </h3>
        <p className="text-sm text-slate-600 text-center max-w-md mb-6">
          Le bail est signé. L&apos;état des lieux d&apos;entrée est requis pour activer le bail
          et remettre les clés au locataire.
        </p>

        <Card className="w-full max-w-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50">
          <CardContent className="p-6">
            <div className="space-y-3 text-sm text-slate-600 mb-6">
              <div className="flex items-start gap-3">
                <Camera className="h-4 w-4 mt-0.5 text-indigo-500 flex-shrink-0" />
                <span>Inspection pièce par pièce avec photos</span>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 mt-0.5 text-indigo-500 flex-shrink-0" />
                <span>Relevé des compteurs (eau, gaz, électricité)</span>
              </div>
              <div className="flex items-start gap-3">
                <Key className="h-4 w-4 mt-0.5 text-indigo-500 flex-shrink-0" />
                <span>Inventaire du trousseau de clés</span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
              onClick={() => router.push(`/owner/inspections/new?lease_id=${leaseId}&property_id=${propertyId}&type=entree`)}
            >
              <Plus className="h-4 w-4" />
              Créer l&apos;EDL d&apos;entrée
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // EDL existe : afficher son statut et les détails
  const statusConfig = EDL_STATUS_CONFIG[edl.status] || EDL_STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 py-4"
    >
      {/* Statut actuel de l'EDL */}
      <Card className={`overflow-hidden ${hasSignedEdl ? "border-emerald-200" : "border-indigo-200"}`}>
        <CardHeader className={`pb-3 ${hasSignedEdl ? "bg-gradient-to-r from-emerald-50 to-green-50" : "bg-gradient-to-r from-indigo-50 to-blue-50"}`}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardCheck className={`h-5 w-5 ${hasSignedEdl ? "text-emerald-600" : "text-indigo-600"}`} />
              État des lieux d&apos;entrée
            </CardTitle>
            <Badge className={statusConfig.color}>
              <StatusIcon className={`h-3 w-3 mr-1 ${edl.status === "in_progress" ? "animate-spin" : ""}`} />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Infos date */}
          <div className="grid grid-cols-2 gap-4">
            {edl.scheduled_at && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date planifiée</p>
                <p className="text-sm font-medium">
                  {new Date(edl.scheduled_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
            {edl.completed_date && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date de réalisation</p>
                <p className="text-sm font-medium">
                  {new Date(edl.completed_date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Boutons d'action selon le statut */}
          <div className="flex flex-wrap gap-2 pt-2">
            {["draft", "scheduled", "in_progress"].includes(edl.status) && (
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => router.push(`/owner/inspections/${edl.id}`)}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Continuer l&apos;EDL
              </Button>
            )}

            {edl.status === "completed" && (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => router.push(`/owner/inspections/${edl.id}`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Signer l&apos;EDL
              </Button>
            )}

            {hasSignedEdl && (
              <Button
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => router.push(`/owner/inspections/${edl.id}`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Voir l&apos;EDL signé
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message de conformité quand signé */}
      {hasSignedEdl && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-full flex-shrink-0">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">EDL d&apos;entrée conforme</p>
              <p className="text-xs text-emerald-700">
                L&apos;état des lieux est signé par toutes les parties. Le bail peut être activé.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
