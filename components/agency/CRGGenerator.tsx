"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Receipt, Loader2 } from "lucide-react";

interface Mandate {
  id: string;
  mandate_number: string;
  owner_name: string;
}

interface CRGGeneratorProps {
  mandates: Mandate[];
  onGenerate: (mandateId: string, periodStart: string, periodEnd: string) => Promise<void>;
  onClose: () => void;
}

export function CRGGenerator({ mandates, onGenerate, onClose }: CRGGeneratorProps) {
  const { toast } = useToast();
  const [selectedMandate, setSelectedMandate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Default: last month
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);

  const [periodStart, setPeriodStart] = useState(lastMonth.toISOString().split("T")[0]);
  const [periodEnd, setPeriodEnd] = useState(lastDay.toISOString().split("T")[0]);

  const handleGenerate = async () => {
    if (!selectedMandate) return;
    setIsGenerating(true);
    try {
      await onGenerate(selectedMandate, periodStart, periodEnd);
      toast({ title: "CRG genere", description: "Le Compte Rendu de Gestion a ete cree." });
      onClose();
    } catch {
      toast({ title: "Erreur", description: "Impossible de generer le CRG.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-0 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Generer un CRG
        </CardTitle>
        <CardDescription>
          Selectionnez un mandat et une periode
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Mandat</Label>
          <Select value={selectedMandate} onValueChange={setSelectedMandate}>
            <SelectTrigger>
              <SelectValue placeholder="Selectionner un mandat" />
            </SelectTrigger>
            <SelectContent>
              {mandates.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.mandate_number} — {m.owner_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="crg_start">Debut de periode</Label>
            <input
              id="crg_start"
              type="date"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crg_end">Fin de periode</Label>
            <input
              id="crg_end"
              type="date"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleGenerate}
            disabled={!selectedMandate || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Receipt className="w-4 h-4 mr-2" />
            )}
            {isGenerating ? "Generation..." : "Generer"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
