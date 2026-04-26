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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { BookmarkPlus, Loader2 } from "lucide-react";

export interface SaveTemplateLineInput {
  title: string;
  description?: string | null;
  quantity: number;
  unit?: string | null;
  /** Prix unitaire en euros (sera converti en cents). */
  unit_price_euros: number;
  tax_rate: number;
}

interface SaveQuoteTemplateDialogProps {
  /** Snapshot des lignes au moment du clic (lazy via callback). */
  getCurrentLines: () => SaveTemplateLineInput[];
  defaultValidityDays?: number;
  defaultTaxRate?: number;
}

export function SaveQuoteTemplateDialog({
  getCurrentLines,
  defaultValidityDays = 30,
  defaultTaxRate = 20,
}: SaveQuoteTemplateDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setCategory("");
    setDescription("");
    setTerms("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Nom requis",
        description: "Donnez un nom à ce template.",
        variant: "destructive",
      });
      return;
    }

    const lines = getCurrentLines().filter(
      (l) => l.title.trim().length > 0 && l.unit_price_euros >= 0,
    );

    if (lines.length === 0) {
      toast({
        title: "Aucune ligne valide",
        description: "Ajoutez au moins une ligne avec un titre avant de sauvegarder.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/provider/quote-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || undefined,
          description: description.trim() || undefined,
          default_validity_days: defaultValidityDays,
          default_tax_rate: defaultTaxRate,
          default_terms: terms.trim() || undefined,
          items: lines.map((l, idx) => ({
            position: idx,
            title: l.title,
            description: l.description ?? undefined,
            quantity: l.quantity,
            unit: l.unit ?? undefined,
            unit_price_cents: Math.round(l.unit_price_euros * 100),
            tax_rate: l.tax_rate,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erreur lors de la sauvegarde");
      }

      toast({
        title: "Template sauvegardé",
        description: `« ${name.trim()} » est désormais disponible dans vos templates.`,
      });
      reset();
      setOpen(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BookmarkPlus className="mr-2 h-4 w-4" />
          Sauvegarder comme template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau template de devis</DialogTitle>
          <DialogDescription>
            Réutilisez ce devis-type pour gagner du temps lors de vos prochains devis similaires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Nom du template *</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Réparation fuite salle de bain"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-category">Catégorie (optionnel)</Label>
            <Input
              id="tpl-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex : Plomberie, Électricité, Peinture"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-description">Description courte</Label>
            <Textarea
              id="tpl-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pour vous aider à retrouver ce template plus tard"
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-terms">Conditions par défaut</Label>
            <Textarea
              id="tpl-terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Conditions de paiement, garanties, délais d'intervention..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <BookmarkPlus className="mr-2 h-4 w-4" />
                Sauvegarder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
