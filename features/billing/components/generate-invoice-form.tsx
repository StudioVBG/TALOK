"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { invoicesService } from "../services/invoices.service";

interface GenerateInvoiceFormProps {
  leaseId: string;
  onSuccess?: () => void;
}

export function GenerateInvoiceForm({ leaseId, onSuccess }: GenerateInvoiceFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [periode, setPeriode] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await invoicesService.generateMonthlyInvoice(leaseId, periode);
      toast({
        title: "Facture générée",
        description: "La facture a été créée avec succès.",
      });
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de la génération";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Générer une facture</CardTitle>
        <CardDescription>Créez une facture mensuelle pour ce bail</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="periode">Période (YYYY-MM)</Label>
            <Input
              id="periode"
              type="month"
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Génération..." : "Générer la facture"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

