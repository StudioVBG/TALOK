"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Shield, Mail, CheckCircle2, Clock, XCircle } from "lucide-react";

type Lease = {
  id: string;
  loyer: number;
  date_debut: string;
  date_fin: string | null;
  property: { adresse_complete: string; ville: string } | null;
};

type Invitation = {
  id: string;
  lease_id: string;
  guarantor_name: string;
  guarantor_email: string;
  guarantor_type: "simple" | "solidaire" | "visale";
  status: "pending" | "accepted" | "declined" | "expired";
  created_at: string;
  accepted_at: string | null;
};

interface Props {
  profileId: string;
  leases: Lease[];
  invitations: Invitation[];
}

const STATUS_BADGE: Record<
  Invitation["status"],
  { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof Clock }
> = {
  pending: { label: "En attente", variant: "secondary", icon: Clock },
  accepted: { label: "Acceptée", variant: "default", icon: CheckCircle2 },
  declined: { label: "Refusée", variant: "destructive", icon: XCircle },
  expired: { label: "Expirée", variant: "destructive", icon: XCircle },
};

export default function TenantGuarantorClient({
  profileId,
  leases,
  invitations,
}: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    lease_id: leases[0]?.id ?? "",
    guarantor_name: "",
    guarantor_email: "",
    guarantor_phone: "",
    guarantor_type: "solidaire" as "simple" | "solidaire" | "visale",
    relationship: "",
  });

  const leasesWithoutInvitation = useMemo(() => {
    const invitedLeaseIds = new Set(
      invitations
        .filter((i) => i.status === "pending" || i.status === "accepted")
        .map((i) => i.lease_id),
    );
    return leases.filter((l) => !invitedLeaseIds.has(l.id));
  }, [leases, invitations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lease_id) {
      toast({
        title: "Sélectionnez un bail",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/guarantors/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lease_id: form.lease_id,
          tenant_profile_id: profileId,
          guarantor_name: form.guarantor_name,
          guarantor_email: form.guarantor_email,
          guarantor_phone: form.guarantor_phone || undefined,
          guarantor_type: form.guarantor_type,
          relationship: form.relationship || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Erreur ${res.status}`);
      }
      toast({
        title: "Invitation envoyée",
        description: `${form.guarantor_name} va recevoir un email à ${form.guarantor_email}.`,
      });
      // Recharge la page pour rafraîchir la liste des invitations
      window.location.reload();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Mon garant</h1>
          <p className="text-muted-foreground">
            Invitez votre garant à signer son acte de cautionnement.
          </p>
        </div>
      </div>

      {/* Invitations existantes */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations envoyées</CardTitle>
            <CardDescription>
              Suivi des garants invités sur vos baux.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((inv) => {
              const status = STATUS_BADGE[inv.status];
              const Icon = status.icon;
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-md border"
                >
                  <div>
                    <p className="font-medium">{inv.guarantor_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {inv.guarantor_email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Caution {inv.guarantor_type} ·{" "}
                      {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Badge variant={status.variant} className="gap-1">
                    <Icon className="w-3 h-3" />
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Formulaire d'invitation */}
      {leasesWithoutInvitation.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Inviter un garant</CardTitle>
            <CardDescription>
              Votre garant recevra un email pour créer son compte et signer son acte
              de cautionnement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {leasesWithoutInvitation.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="lease_id">Bail concerné</Label>
                  <Select
                    value={form.lease_id}
                    onValueChange={(v) => setForm({ ...form, lease_id: v })}
                  >
                    <SelectTrigger id="lease_id">
                      <SelectValue placeholder="Sélectionnez un bail" />
                    </SelectTrigger>
                    <SelectContent>
                      {leasesWithoutInvitation.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.property?.adresse_complete ?? "Bail"}
                          {l.property?.ville ? `, ${l.property.ville}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="guarantor_name">Nom complet du garant</Label>
                <Input
                  id="guarantor_name"
                  required
                  value={form.guarantor_name}
                  onChange={(e) =>
                    setForm({ ...form, guarantor_name: e.target.value })
                  }
                  placeholder="Jean Dupont"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guarantor_email">Email du garant</Label>
                <Input
                  id="guarantor_email"
                  type="email"
                  required
                  value={form.guarantor_email}
                  onChange={(e) =>
                    setForm({ ...form, guarantor_email: e.target.value })
                  }
                  placeholder="garant@exemple.fr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guarantor_phone">
                  Téléphone (optionnel, format +33...)
                </Label>
                <Input
                  id="guarantor_phone"
                  type="tel"
                  value={form.guarantor_phone}
                  onChange={(e) =>
                    setForm({ ...form, guarantor_phone: e.target.value })
                  }
                  placeholder="+33612345678"
                  pattern="^\+[1-9]\d{1,14}$"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guarantor_type">Type de cautionnement</Label>
                <Select
                  value={form.guarantor_type}
                  onValueChange={(v: "simple" | "solidaire" | "visale") =>
                    setForm({ ...form, guarantor_type: v })
                  }
                >
                  <SelectTrigger id="guarantor_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solidaire">
                      Solidaire (recommandé)
                    </SelectItem>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="visale">Visale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">Relation (optionnel)</Label>
                <Input
                  id="relationship"
                  value={form.relationship}
                  onChange={(e) =>
                    setForm({ ...form, relationship: e.target.value })
                  }
                  placeholder="Parent, employeur, ami..."
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Envoi en cours..." : "Envoyer l'invitation"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : leases.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Vous n'avez pas de bail actif. Une fois votre bail signé, vous pourrez
            inviter votre garant ici.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Tous vos baux ont déjà un garant invité. Voir ci-dessus pour le suivi.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
