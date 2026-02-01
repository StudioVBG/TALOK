"use client";
// @ts-nocheck

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ClipboardCheck,
  Plus,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react";

interface EDL {
  id: string;
  type: "entree" | "sortie";
  status: string;
  scheduled_at?: string | null;
  completed_date?: string | null;
  created_at: string;
}

interface InspectionViewProps {
  leaseId: string;
  leaseStatus: string;
  propertyId: string;
  edls: EDL[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: Clock },
  scheduled: { label: "Programmé", color: "bg-blue-100 text-blue-700", icon: Calendar },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700", icon: ClipboardCheck },
  completed: { label: "Complété", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  signed: { label: "Signé", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  disputed: { label: "Contesté", color: "bg-red-100 text-red-700", icon: Clock },
};

export function InspectionView({ leaseId, leaseStatus, propertyId, edls }: InspectionViewProps) {
  const entryEdl = edls.find((e) => e.type === "entree");
  const exitEdl = edls.find((e) => e.type === "sortie");

  const canCreateEntry = !entryEdl && ["fully_signed", "active"].includes(leaseStatus);
  const canCreateExit = !exitEdl && ["active", "notice_given"].includes(leaseStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">États des lieux</h2>
        {(canCreateEntry || canCreateExit) && (
          <Button size="sm" asChild>
            <Link
              href={`/owner/inspections/new?lease_id=${leaseId}&property_id=${propertyId}&type=${canCreateEntry ? "entree" : "sortie"}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un EDL {canCreateEntry ? "d'entrée" : "de sortie"}
            </Link>
          </Button>
        )}
      </div>

      {edls.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Aucun état des lieux"
          description={
            canCreateEntry
              ? "Créez l'état des lieux d'entrée pour ce bail."
              : "L'état des lieux sera disponible une fois le bail signé."
          }
          action={
            canCreateEntry
              ? {
                  label: "Créer l'EDL d'entrée",
                  href: `/owner/inspections/new?lease_id=${leaseId}&property_id=${propertyId}&type=entree`,
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Entry EDL */}
          <EDLCard
            title="EDL d'entrée"
            edl={entryEdl}
            leaseId={leaseId}
            propertyId={propertyId}
            type="entree"
            canCreate={canCreateEntry}
          />

          {/* Exit EDL */}
          <EDLCard
            title="EDL de sortie"
            edl={exitEdl}
            leaseId={leaseId}
            propertyId={propertyId}
            type="sortie"
            canCreate={canCreateExit}
          />
        </div>
      )}
    </div>
  );
}

function EDLCard({
  title,
  edl,
  leaseId,
  propertyId,
  type,
  canCreate,
}: {
  title: string;
  edl?: EDL;
  leaseId: string;
  propertyId: string;
  type: "entree" | "sortie";
  canCreate: boolean;
}) {
  if (!edl && !canCreate) return null;

  const config = edl ? STATUS_CONFIG[edl.status] || STATUS_CONFIG.draft : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{title}</span>
          {config && (
            <Badge className={config.color} variant="outline">
              {config.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {edl ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {edl.completed_date ? (
                <p>Complété le {new Date(edl.completed_date).toLocaleDateString("fr-FR")}</p>
              ) : edl.scheduled_at ? (
                <p>Programmé le {new Date(edl.scheduled_at).toLocaleDateString("fr-FR")}</p>
              ) : (
                <p>Créé le {new Date(edl.created_at).toLocaleDateString("fr-FR")}</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={`/owner/inspections/${edl.id}`}>
                <ArrowRight className="h-4 w-4 mr-2" />
                {["draft", "scheduled", "in_progress"].includes(edl.status)
                  ? "Continuer"
                  : "Voir le détail"}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">Pas encore créé</p>
            <Button size="sm" asChild>
              <Link href={`/owner/inspections/new?lease_id=${leaseId}&property_id=${propertyId}&type=${type}`}>
                <Plus className="h-4 w-4 mr-2" />
                Créer
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
