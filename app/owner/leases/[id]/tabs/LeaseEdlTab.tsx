"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
  Home,
  Pencil,
  Image,
  FileSignature,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { EDLPreview } from "@/features/edl/components/edl-preview";

interface EdlData {
  id: string;
  status: string;
  type: string;
  scheduled_at?: string | null;
  completed_date?: string | null;
  total_items?: number;
  completed_items?: number;
  total_photos?: number;
  signatures_count?: number;
}

interface LeaseEdlTabProps {
  leaseId: string;
  propertyId: string;
  leaseStatus: string;
  edl: EdlData | null;
  hasSignedEdl: boolean;
  /** Données optionnelles du bail pour enrichir le preview EDL */
  propertyAddress?: string;
  propertyCity?: string;
  propertyType?: string;
  typeBail?: string;
}

const EDL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: FileText },
  scheduled: { label: "Planifié", color: "bg-blue-100 text-blue-700", icon: Calendar },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700", icon: Loader2 },
  completed: { label: "Complété", color: "bg-indigo-100 text-indigo-700", icon: CheckCircle },
  signed: { label: "Signé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  disputed: { label: "Contesté", color: "bg-red-100 text-red-700", icon: AlertTriangle },
};

export function LeaseEdlTab({
  leaseId,
  propertyId,
  leaseStatus,
  edl,
  hasSignedEdl,
  propertyAddress,
  propertyCity,
  propertyType,
  typeBail,
}: LeaseEdlTabProps) {
  // Bail pas encore signé : EDL non disponible
  const bailNotReady = !["fully_signed", "active", "notice_given", "terminated", "archived"].includes(leaseStatus);

  if (bailNotReady) {
    return (
      <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
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
        className="flex flex-col items-center justify-center py-6 sm:py-10 px-4"
      >
        <div className="p-4 bg-indigo-100 rounded-full mb-4">
          <ClipboardCheck className="h-8 w-8 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Créer l&apos;état des lieux d&apos;entrée
        </h3>
        <p className="text-sm text-slate-600 text-center max-w-md mb-4">
          Le bail est signé. L&apos;état des lieux d&apos;entrée est requis pour activer le bail
          et remettre les clés au locataire.
        </p>

        {/* CTA en premier — toujours visible sans scroll */}
        <Link
          href={`/owner/inspections/new?lease_id=${leaseId}&property_id=${propertyId}&type=entree`}
          className={cn(
            buttonVariants({ size: "lg" }),
            "w-full max-w-lg h-14 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 gap-3"
          )}
        >
          <Home className="h-5 w-5" />
          Commencer l&apos;état des lieux d&apos;entrée
          <ArrowRight className="h-5 w-5" />
        </Link>

        <Card className="w-full max-w-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 mt-6">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3 text-sm text-slate-600">
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
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // EDL existe : afficher son statut et les détails
  const statusConfig = EDL_STATUS_CONFIG[edl.status] || EDL_STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;

  // Calcul de la progression
  const completionPercent = edl.total_items && edl.total_items > 0
    ? Math.round(((edl.completed_items || 0) / edl.total_items) * 100)
    : 0;
  const isIncomplete = ["draft", "scheduled", "in_progress"].includes(edl.status);
  const isCompleted = edl.status === "completed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 sm:space-y-6 py-4"
    >
      {/* Statut actuel de l'EDL + progression */}
      <Card className={`overflow-hidden ${hasSignedEdl ? "border-emerald-200" : "border-indigo-200"}`}>
        <CardHeader className={`pb-3 ${hasSignedEdl ? "bg-gradient-to-r from-emerald-50 to-green-50" : "bg-gradient-to-r from-indigo-50 to-blue-50"}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <ClipboardCheck className={`h-4 w-4 sm:h-5 sm:w-5 ${hasSignedEdl ? "text-emerald-600" : "text-indigo-600"}`} />
              État des lieux d&apos;entrée
            </CardTitle>
            <Badge className={statusConfig.color}>
              <StatusIcon className={`h-3 w-3 mr-1 ${edl.status === "in_progress" ? "animate-spin" : ""}`} />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Progression de l'inspection — visible si des items existent */}
          {edl.total_items != null && edl.total_items > 0 && !hasSignedEdl && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Éléments inspectés</span>
                <span className="font-semibold text-slate-700">
                  {edl.completed_items || 0} / {edl.total_items} ({completionPercent}%)
                </span>
              </div>
              <Progress value={completionPercent} className="h-2" />
              <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                {edl.total_photos != null && edl.total_photos > 0 && (
                  <span className="flex items-center gap-1">
                    <Image className="h-3 w-3" /> {edl.total_photos} photo{(edl.total_photos || 0) > 1 ? "s" : ""}
                  </span>
                )}
                {edl.signatures_count != null && (
                  <span className="flex items-center gap-1">
                    <FileSignature className="h-3 w-3" /> {edl.signatures_count}/2 signature{(edl.signatures_count || 0) > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Infos date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

          {/* CTA unique selon le statut — 1 seul bouton primaire pour réduire la redondance */}
          <div className="flex flex-wrap gap-2 pt-2">
            {isIncomplete && (
              <Link
                href={`/owner/inspections/${edl.id}`}
                className={cn(buttonVariants({ variant: "default" }), "h-11 px-5 bg-indigo-600 hover:bg-indigo-700 gap-2")}
                aria-label="Continuer l'état des lieux"
              >
                <Pencil className="h-4 w-4" />
                Continuer l&apos;EDL
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            {isCompleted && (
              <Link
                href={`/owner/inspections/${edl.id}`}
                className={cn(buttonVariants({ variant: "default" }), "h-11 px-5 bg-blue-600 hover:bg-blue-700 gap-2")}
                aria-label="Signer l'état des lieux"
              >
                <FileSignature className="h-4 w-4" />
                Signer l&apos;EDL
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            {hasSignedEdl && (
              <Link
                href={`/owner/inspections/${edl.id}`}
                className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2")}
                aria-label="Voir l'état des lieux signé"
              >
                <ExternalLink className="h-4 w-4" />
                Consulter l&apos;EDL signé
              </Link>
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

      {/* Aperçu du document EDL — responsive avec hauteur adaptative */}
      <div className="min-h-[300px] sm:min-h-[400px] md:min-h-[500px]">
        <EDLPreview
          edlData={{
            type: edl.type as "entree" | "sortie",
            logement: propertyAddress ? {
              adresse_complete: propertyAddress,
              ville: propertyCity || "",
              code_postal: "",
              type_bien: propertyType || "",
            } : undefined,
          }}
          edlId={edl.id}
        />
      </div>
    </motion.div>
  );
}
