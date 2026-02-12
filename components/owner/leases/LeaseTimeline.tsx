"use client";

import { useMemo } from "react";
import {
  FileText,
  PenTool,
  ClipboardCheck,
  Euro,
  Key,
  CalendarOff,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  date: Date;
  label: string;
  description?: string;
  icon: React.ElementType;
  color: "green" | "blue" | "amber" | "red" | "slate" | "indigo";
  completed: boolean;
}

interface LeaseTimelineProps {
  lease: {
    created_at: string;
    statut: string;
    date_debut: string;
    date_fin?: string | null;
    sealed_at?: string | null;
    activated_at?: string | null;
    terminated_at?: string | null;
  };
  signers: Array<{
    role: string;
    signed_at?: string | null;
    profile?: { prenom?: string; nom?: string } | null;
  }>;
  edl?: {
    id: string;
    status: string;
    created_at?: string;
    completed_date?: string | null;
  } | null;
  payments?: Array<{
    created_at: string;
    statut: string;
    montant?: number;
  }>;
}

const colorClasses: Record<string, { dot: string; line: string; text: string }> = {
  green:  { dot: "bg-emerald-500", line: "bg-emerald-200", text: "text-emerald-700" },
  blue:   { dot: "bg-blue-500",    line: "bg-blue-200",    text: "text-blue-700" },
  amber:  { dot: "bg-amber-500",   line: "bg-amber-200",   text: "text-amber-700" },
  red:    { dot: "bg-red-500",     line: "bg-red-200",     text: "text-red-700" },
  slate:  { dot: "bg-slate-300",   line: "bg-slate-200",   text: "text-slate-500" },
  indigo: { dot: "bg-indigo-500",  line: "bg-indigo-200",  text: "text-indigo-700" },
};

export function LeaseTimeline({ lease, signers, edl, payments }: LeaseTimelineProps) {
  const events = useMemo(() => {
    const items: TimelineEvent[] = [];

    // 1. Création du bail
    items.push({
      id: "creation",
      date: new Date(lease.created_at),
      label: "Bail créé",
      description: "Brouillon du contrat",
      icon: FileText,
      color: "blue",
      completed: true,
    });

    // 2. Signatures
    const tenantSigner = signers?.find(s =>
      ["locataire_principal", "locataire", "colocataire"].includes(s.role)
    );
    const ownerSigner = signers?.find(s =>
      ["proprietaire", "owner", "bailleur"].includes(s.role)
    );

    if (tenantSigner?.signed_at) {
      const name = tenantSigner.profile
        ? `${tenantSigner.profile.prenom || ""} ${tenantSigner.profile.nom || ""}`.trim()
        : "Locataire";
      items.push({
        id: "tenant_sign",
        date: new Date(tenantSigner.signed_at),
        label: "Signature locataire",
        description: `${name} a signé`,
        icon: PenTool,
        color: "green",
        completed: true,
      });
    }

    if (ownerSigner?.signed_at) {
      items.push({
        id: "owner_sign",
        date: new Date(ownerSigner.signed_at),
        label: "Signature propriétaire",
        description: "Le bail est entièrement signé",
        icon: PenTool,
        color: "green",
        completed: true,
      });
    }

    // 3. État des lieux
    if (edl) {
      const edlDate = edl.completed_date || edl.created_at;
      if (edlDate) {
        const edlCompleted = edl.status === "signed" || edl.status === "completed";
        items.push({
          id: "edl",
          date: new Date(edlDate),
          label: edlCompleted ? "EDL réalisé" : "EDL en cours",
          description: edlCompleted
            ? "État des lieux d'entrée signé"
            : `Statut : ${edl.status === "in_progress" ? "en cours" : edl.status === "draft" ? "brouillon" : edl.status}`,
          icon: ClipboardCheck,
          color: edlCompleted ? "green" : "amber",
          completed: edlCompleted,
        });
      }
    }

    // 4. Premier paiement
    const firstPayment = payments?.find(p => p.statut === "succeeded" || p.statut === "paid");
    if (firstPayment) {
      items.push({
        id: "first_payment",
        date: new Date(firstPayment.created_at),
        label: "1er paiement reçu",
        description: firstPayment.montant ? `${firstPayment.montant.toLocaleString("fr-FR")} €` : undefined,
        icon: Euro,
        color: "green",
        completed: true,
      });
    }

    // 5. Activation
    if (lease.statut === "active" || (lease as any).activated_at) {
      const activationDate = (lease as any).activated_at || lease.sealed_at;
      if (activationDate) {
        items.push({
          id: "activation",
          date: new Date(activationDate),
          label: "Bail activé",
          description: "Le locataire est installé",
          icon: Key,
          color: "green",
          completed: true,
        });
      }
    }

    // 6. Résiliation
    if (lease.statut === "terminated" && (lease as any).terminated_at) {
      items.push({
        id: "terminated",
        date: new Date((lease as any).terminated_at),
        label: "Bail résilié",
        description: "Le contrat est terminé",
        icon: CalendarOff,
        color: "red",
        completed: true,
      });
    }

    // Trier par date
    items.sort((a, b) => a.date.getTime() - b.date.getTime());

    return items;
  }, [lease, signers, edl, payments]);

  // Ajouter les étapes futures non complétées
  const futureSteps = useMemo(() => {
    const items: TimelineEvent[] = [];
    const statut = lease.statut;

    if (!signers?.some(s => s.role === "locataire_principal" && s.signed_at) &&
        ["draft", "pending_signature", "partially_signed"].includes(statut)) {
      items.push({
        id: "future_tenant",
        date: new Date(),
        label: "Signature locataire",
        description: "En attente",
        icon: Clock,
        color: "slate",
        completed: false,
      });
    }

    if (!signers?.some(s => s.role === "proprietaire" && s.signed_at) &&
        ["draft", "pending_signature", "partially_signed"].includes(statut)) {
      items.push({
        id: "future_owner",
        date: new Date(),
        label: "Signature propriétaire",
        description: "En attente",
        icon: Clock,
        color: "slate",
        completed: false,
      });
    }

    if (!edl && ["fully_signed"].includes(statut)) {
      items.push({
        id: "future_edl",
        date: new Date(),
        label: "État des lieux",
        description: "À réaliser",
        icon: ClipboardCheck,
        color: "slate",
        completed: false,
      });
    }

    if (statut !== "active" && statut !== "terminated") {
      items.push({
        id: "future_active",
        date: new Date(),
        label: "Activation du bail",
        description: "Prochaine étape",
        icon: Key,
        color: "slate",
        completed: false,
      });
    }

    return items;
  }, [lease.statut, signers, edl]);

  const allEvents = [...events, ...futureSteps];

  if (allEvents.length === 0) return null;

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <CardHeader className="pb-2 border-b border-slate-50">
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <Clock className="h-3 w-3 text-blue-500" />
          Chronologie
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="relative">
          {allEvents.map((event, index) => {
            const colors = colorClasses[event.color] || colorClasses.slate;
            const Icon = event.icon;
            const isLast = index === allEvents.length - 1;

            return (
              <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                {/* Ligne verticale */}
                {!isLast && (
                  <div className={cn(
                    "absolute left-[11px] top-6 bottom-0 w-0.5",
                    event.completed ? colors.line : "bg-slate-100"
                  )} />
                )}
                {/* Point/Icône */}
                <div className={cn(
                  "relative z-10 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center",
                  event.completed ? colors.dot : "bg-slate-100 border-2 border-dashed border-slate-300"
                )}>
                  <Icon className={cn("h-3 w-3", event.completed ? "text-white" : "text-slate-400")} />
                </div>
                {/* Contenu */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={cn(
                    "text-xs font-semibold leading-tight",
                    event.completed ? "text-slate-800" : "text-slate-400"
                  )}>
                    {event.label}
                  </p>
                  {event.description && (
                    <p className={cn(
                      "text-[10px] mt-0.5",
                      event.completed ? "text-slate-500" : "text-slate-400"
                    )}>
                      {event.description}
                    </p>
                  )}
                  {event.completed && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {event.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
