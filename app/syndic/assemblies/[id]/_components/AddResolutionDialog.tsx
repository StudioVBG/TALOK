"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus } from "lucide-react";

interface AddResolutionDialogProps {
  assemblyId: string;
  nextResolutionNumber: number;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES = [
  { value: "gestion", label: "Gestion courante" },
  { value: "budget", label: "Budget prévisionnel" },
  { value: "travaux", label: "Travaux" },
  { value: "reglement", label: "Modification du règlement" },
  { value: "honoraires", label: "Honoraires syndic" },
  { value: "conseil_syndical", label: "Conseil syndical" },
  { value: "assurance", label: "Assurance" },
  { value: "conflits", label: "Actions en justice" },
  { value: "autre", label: "Autre" },
];

const MAJORITY_RULES = [
  {
    value: "article_24",
    label: "Article 24 — Majorité simple",
    description: "Majorité des voix des copropriétaires présents ou représentés",
  },
  {
    value: "article_25",
    label: "Article 25 — Majorité absolue",
    description: "Majorité absolue des voix de tous les copropriétaires",
  },
  {
    value: "article_25_1",
    label: "Article 25-1 — Article 25 avec passerelle",
    description: "Article 25 avec second vote article 24 possible",
  },
  {
    value: "article_26",
    label: "Article 26 — Double majorité",
    description: "2/3 des copropriétaires représentant 2/3 des tantièmes",
  },
  {
    value: "article_26_1",
    label: "Article 26-1 — Article 26 avec passerelle",
    description: "Article 26 avec passerelle article 25",
  },
  {
    value: "unanimite",
    label: "Unanimité",
    description: "Accord de tous les copropriétaires",
  },
];

export function AddResolutionDialog({
  assemblyId,
  nextResolutionNumber,
  onClose,
  onCreated,
}: AddResolutionDialogProps) {
  const { toast } = useToast();
  const isSubmittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    resolution_number: nextResolutionNumber,
    title: "",
    description: "",
    category: "gestion",
    majority_rule: "article_24",
    estimated_amount: "",
    contract_partner: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!form.title || form.title.length < 3) {
      toast({ title: "Titre trop court", description: "Min 3 caractères", variant: "destructive" });
      return;
    }
    if (!form.description || form.description.length < 3) {
      toast({ title: "Description requise", variant: "destructive" });
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const payload: Record<string, any> = {
        resolution_number: form.resolution_number,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        majority_rule: form.majority_rule,
      };

      if (form.estimated_amount) {
        const amount = parseFloat(form.estimated_amount);
        if (!isNaN(amount) && amount >= 0) {
          payload.estimated_amount_cents = Math.round(amount * 100);
        }
      }
      if (form.contract_partner.trim()) {
        payload.contract_partner = form.contract_partner.trim();
      }

      const res = await fetch(`/api/copro/assemblies/${assemblyId}/resolutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la création");
      }

      toast({
        title: "Résolution ajoutée",
        description: `Résolution #${form.resolution_number} créée`,
      });

      onCreated();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer la résolution",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Plus className="h-5 w-5 text-violet-400" />
            Ajouter une résolution
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Créez une résolution à soumettre au vote de l'assemblée
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">N° ordre</Label>
              <Input
                type="number"
                min="1"
                value={form.resolution_number}
                onChange={(e) => setForm({ ...form, resolution_number: parseInt(e.target.value, 10) || 1 })}
                required
                disabled={submitting}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Titre *</Label>
              <Input
                placeholder="Ex: Approbation des comptes 2025"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                disabled={submitting}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Description *</Label>
            <Textarea
              placeholder="Description détaillée de la résolution, contexte, enjeux..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              required
              disabled={submitting}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Catégorie</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
                disabled={submitting}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Règle de majorité *</Label>
              <Select
                value={form.majority_rule}
                onValueChange={(value) => setForm({ ...form, majority_rule: value })}
                disabled={submitting}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAJORITY_RULES.map((rule) => (
                    <SelectItem key={rule.value} value={rule.value}>
                      <div>
                        <div className="font-medium">{rule.label}</div>
                        <div className="text-xs text-slate-500">{rule.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Montant estimé (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Optionnel (pour travaux, devis)"
                value={form.estimated_amount}
                onChange={(e) => setForm({ ...form, estimated_amount: e.target.value })}
                disabled={submitting}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Entreprise / Prestataire</Label>
              <Input
                placeholder="Optionnel (nom de l'entreprise)"
                value={form.contract_partner}
                onChange={(e) => setForm({ ...form, contract_partner: e.target.value })}
                disabled={submitting}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter la résolution
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
