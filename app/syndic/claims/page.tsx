"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  MapPin,
  Loader2,
  Inbox,
  User,
} from "lucide-react";

interface Claim {
  id: string;
  building_id: string;
  site_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  claim_message: string | null;
  decision_reason: string | null;
  created_at: string;
  building?: {
    id: string;
    name: string | null;
    adresse_complete: string | null;
    code_postal: string | null;
    ville: string | null;
    ownership_type: string | null;
    total_lots_in_building: number | null;
    owner?: {
      id: string;
      prenom: string | null;
      nom: string | null;
      email_contact: string | null;
    } | null;
  };
  site?: { id: string; name: string };
}

const STATUS_BADGE: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: {
    label: "En attente",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  approved: {
    label: "Approuvée",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Refusée",
    className: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
  cancelled: {
    label: "Annulée",
    className: "bg-slate-100 text-slate-700 border-slate-200",
    icon: XCircle,
  },
};

export default function SyndicClaimsPage() {
  const { toast } = useToast();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");

  const [decision, setDecision] = useState<{
    claimId: string;
    type: "approve" | "reject";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/syndic/site-claims?status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setClaims(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleDecide() {
    if (!decision) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/syndic/site-claims/${decision.claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decision.type,
          reason: reason || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      toast({
        title: decision.type === "approve" ? "Demande approuvée" : "Demande refusée",
      });
      setDecision(null);
      setReason("");
      load();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = claims.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-violet-600" />
            Demandes de rattachement
          </h1>
          <p className="text-muted-foreground">
            Validez les copropriétaires qui souhaitent connecter leur immeuble à vos copropriétés Talok.
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={statusFilter === "pending" ? "default" : "outline"}
            onClick={() => setStatusFilter("pending")}
          >
            En attente {pendingCount > 0 && <Badge className="ml-2 bg-white text-amber-700">{pendingCount}</Badge>}
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            Tout l'historique
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : claims.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>
              {statusFilter === "pending"
                ? "Aucune demande en attente."
                : "Aucune demande dans l'historique."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => {
            const config = STATUS_BADGE[claim.status] ?? STATUS_BADGE.pending;
            const Icon = config.icon;
            const owner = claim.building?.owner;
            const ownerName = owner
              ? [owner.prenom, owner.nom].filter(Boolean).join(" ") || "Copropriétaire"
              : "Copropriétaire";
            const isPending = claim.status === "pending";
            return (
              <Card key={claim.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-600" />
                        {claim.building?.name ?? "Immeuble"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Vers <span className="font-medium">{claim.site?.name ?? "—"}</span>
                      </p>
                    </div>
                    <Badge className={`${config.className} border`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                        Demandeur
                      </p>
                      <p className="text-foreground inline-flex items-center gap-1.5">
                        <User className="w-3 h-3" />
                        {ownerName}
                      </p>
                      {owner?.email_contact && (
                        <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                          <Mail className="w-3 h-3" />
                          {owner.email_contact}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                        Adresse
                      </p>
                      <p className="text-foreground inline-flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        {claim.building?.adresse_complete ?? "—"}
                      </p>
                      {claim.building?.code_postal && claim.building.ville && (
                        <p className="text-muted-foreground text-xs">
                          {claim.building.code_postal} {claim.building.ville}
                        </p>
                      )}
                    </div>
                    {claim.building?.ownership_type === "partial" &&
                      claim.building.total_lots_in_building && (
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                            Possession
                          </p>
                          <p className="text-foreground">
                            Copropriétaire partiel · sur {claim.building.total_lots_in_building} lots de l'immeuble
                          </p>
                        </div>
                      )}
                    <div>
                      <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                        Date
                      </p>
                      <p className="text-foreground">
                        {new Date(claim.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {claim.claim_message && (
                    <div className="rounded-lg bg-muted/40 p-3 text-sm">
                      <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                        Message
                      </p>
                      <p className="text-foreground italic">« {claim.claim_message} »</p>
                    </div>
                  )}

                  {claim.decision_reason && !isPending && (
                    <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                      Motif : {claim.decision_reason}
                    </div>
                  )}

                  {isPending && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDecision({ claimId: claim.id, type: "reject" })}
                        className="text-red-600 hover:bg-red-50 border-red-200"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Refuser
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setDecision({ claimId: claim.id, type: "approve" })}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approuver
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.type === "approve" ? "Approuver la demande" : "Refuser la demande"}
            </DialogTitle>
            <DialogDescription>
              {decision?.type === "approve"
                ? "Le copropriétaire aura accès en lecture seule aux informations de la copropriété."
                : "Indiquez la raison du refus pour informer le copropriétaire."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                decision?.type === "approve"
                  ? "Note interne (optionnelle)"
                  : "Raison du refus"
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleDecide}
              disabled={submitting}
              className={
                decision?.type === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {decision?.type === "approve" ? "Approuver" : "Refuser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
