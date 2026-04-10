"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Shield } from "lucide-react";
import { colocationMembersService } from "../services/members.service";
import type { ColocationMemberWithDetails } from "../types";

interface DepartureModalProps {
  member: ColocationMemberWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function DepartureModal({
  member,
  open,
  onOpenChange,
  onSaved,
}: DepartureModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState("");

  const solidarityEndDate = effectiveDate
    ? new Date(new Date(effectiveDate).getTime() + 6 * 30 * 24 * 60 * 60 * 1000)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveDate) return;

    setError(null);
    setSaving(true);

    try {
      await colocationMembersService.declareDeparture(member.id, {
        notice_effective_date: effectiveDate,
      });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la declaration de depart");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Declarer un depart
          </DialogTitle>
          <DialogDescription>
            Declarer le depart de {member.profile?.prenom} {member.profile?.nom}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="effective_date">Date d&apos;effet du conge</Label>
            <Input
              id="effective_date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Preavis : 1 mois (meuble) ou 3 mois (nu)
            </p>
          </div>

          {solidarityEndDate && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <Shield className="h-4 w-4" />
                <span>
                  Solidarite jusqu&apos;au{" "}
                  <strong>
                    {solidarityEndDate.toLocaleDateString("fr-FR")}
                  </strong>
                </span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                La solidarite s&apos;eteint immediatement si un remplacant est nomme au bail
                (loi ALUR, max 6 mois)
              </p>
            </div>
          )}

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Part loyer :</strong>{" "}
              {(member.rent_share_cents / 100).toFixed(0)}€/mois
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Depot de garantie :</strong>{" "}
              {(member.deposit_cents / 100).toFixed(0)}€
            </p>
            {member.room && (
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Chambre :</strong> {member.room.room_number}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={saving || !effectiveDate}
            >
              {saving ? "Enregistrement..." : "Confirmer le depart"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
