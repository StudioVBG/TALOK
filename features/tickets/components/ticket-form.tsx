"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ticketsService } from "../services/tickets.service";
import { leasesService } from "@/features/leases/services/leases.service";
import type { CreateTicketData } from "../services/tickets.service";
import type { TicketPriority, Lease } from "@/lib/types";
import { useAuth } from "@/lib/hooks/use-auth";

interface TicketFormProps {
  propertyId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TicketForm({ propertyId, onSuccess, onCancel }: TicketFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [formData, setFormData] = useState<CreateTicketData>({
    property_id: propertyId || "",
    lease_id: null,
    titre: "",
    description: "",
    priorite: "normale",
  });

  useEffect(() => {
    // Charger les baux du locataire si c'est un locataire
    if (profile && profile.role === "tenant" && propertyId) {
      leasesService
        .getLeasesByTenant(profile.id)
        .then((data) => {
          const propertyLeases = data.filter((l) => l.property_id === propertyId);
          setLeases(propertyLeases);
        })
        .catch(() => {});
    }
  }, [profile, propertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await ticketsService.createTicket(formData);
      toast({
        title: "Ticket créé",
        description: "Votre ticket a été créé avec succès.",
      });
      onSuccess?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau ticket</CardTitle>
        <CardDescription>Signalez un problème ou une demande de maintenance</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre</Label>
            <Input
              id="titre"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Ex: Fuite d'eau dans la salle de bain"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Décrivez le problème en détail..."
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priorite">Priorité</Label>
            <select
              id="priorite"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.priorite}
              onChange={(e) =>
                setFormData({ ...formData, priorite: e.target.value as TicketPriority })
              }
              required
              disabled={loading}
            >
              <option value="basse">Basse</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
            </select>
          </div>

          {leases.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="lease_id">Bail associé (optionnel)</Label>
              <select
                id="lease_id"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.lease_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, lease_id: e.target.value || null })
                }
                disabled={loading}
              >
                <option value="">Aucun</option>
                {leases.map((lease) => (
                  <option key={lease.id} value={lease.id}>
                    Bail du {new Date(lease.date_debut).toLocaleDateString("fr-FR")}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer le ticket"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

