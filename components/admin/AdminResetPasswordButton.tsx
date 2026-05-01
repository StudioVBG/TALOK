"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { KeyRound, Loader2 } from "lucide-react";
import { getClientCsrfToken } from "@/lib/security/csrf";

interface Props {
  profileId: string;
  email: string;
  userName: string;
}

/**
 * Bouton admin pour déclencher un email de réinitialisation de mot de passe
 * pour l'utilisateur ciblé. Demande une raison (audit log).
 */
export function AdminResetPasswordButton({ profileId, email, userName }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 3) {
      toast({
        title: "Raison requise",
        description: "Indiquez la raison interne (≥ 3 caractères).",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const csrfToken = getClientCsrfToken();
      const res = await fetch(`/api/admin/people/${profileId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
      toast({
        title: "Email envoyé",
        description: json?.message || `Un email a été envoyé à ${email}.`,
      });
      setReason("");
      setOpen(false);
    } catch (err) {
      toast({
        title: "Échec",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="w-4 h-4 mr-2" />
          Réinitialiser le mot de passe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            Un email contenant un lien de réinitialisation va être envoyé à{" "}
            <strong>{email}</strong> ({userName}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="admin-reset-reason">Raison interne (audit)</Label>
          <Textarea
            id="admin-reset-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Demande utilisateur, support ticket #1234..."
            rows={3}
            disabled={submitting}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Envoyer l'email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
