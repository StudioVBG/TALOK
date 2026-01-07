"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  UserPlus,
  Mail,
  User,
  Loader2,
  CheckCircle,
  Info,
  Shield,
} from "lucide-react";

interface TenantInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaseId: string;
  property: {
    adresse_complete: string;
    ville: string;
    code_postal: string;
  };
  role: "locataire_principal" | "colocataire" | "garant";
  ownerName: string;
  onSuccess?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  locataire_principal: "locataire principal",
  colocataire: "colocataire",
  garant: "garant",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  locataire_principal: "Le locataire principal sera responsable du bail et recevra les appels de loyer.",
  colocataire: "Le colocataire sera ajouté au bail avec une part définie du loyer.",
  garant: "Le garant se porte caution solidaire pour le locataire.",
};

export function TenantInviteModal({
  open,
  onOpenChange,
  leaseId,
  property,
  role,
  ownerName,
  onSuccess,
}: TenantInviteModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value: string) => {
    if (!value) {
      setEmailError("");
      return false;
    }
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    setEmailError(isValid ? "" : "Email invalide");
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      toast({
        title: "Email invalide",
        description: "Veuillez entrer une adresse email valide",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/signers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || null,
          role,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'invitation");
      }

      const result = await response.json();

      toast({
        title: "Invitation envoyée !",
        description: result.message || `Une invitation a été envoyée à ${email}`,
      });

      // Réinitialiser le formulaire
      setEmail("");
      setName("");
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setEmail("");
      setName("");
      setEmailError("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Inviter un {ROLE_LABELS[role]}
          </DialogTitle>
          <DialogDescription>
            {property.adresse_complete}, {property.code_postal} {property.ville}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Info sur le rôle */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="exemple@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              onBlur={() => validateEmail(email)}
              className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
              disabled={submitting}
            />
            {emailError && (
              <p className="text-xs text-red-500">{emailError}</p>
            )}
          </div>

          {/* Nom (optionnel) */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Nom complet
              <span className="text-xs text-muted-foreground">(optionnel)</span>
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Prénom Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Info signature */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
              <div className="text-sm text-slate-600">
                <p className="font-medium">Processus sécurisé</p>
                <p className="text-xs mt-1">
                  La personne recevra un email avec un lien pour créer son compte
                  et signer électroniquement le bail.
                </p>
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting || !email}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Envoyer l'invitation
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

