"use client";
// @ts-nocheck

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  FileText,
  Euro,
  CalendarIcon,
  Plus,
  Trash2,
  Send,
  Save,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export default function NewQuotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const preselectedJobId = searchParams.get("jobId");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    property_address: "",
    description: "",
    valid_until: addDays(new Date(), 30),
    notes: "",
  });

  const [lines, setLines] = useState<QuoteLine[]>([
    { id: "1", description: "", quantity: 1, unit_price: 0 },
  ]);

  const addLine = () => {
    setLines([
      ...lines,
      { id: Date.now().toString(), description: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((l) => l.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof QuoteLine, value: string | number) => {
    setLines(
      lines.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const calculateSubtotal = () => {
    return lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
  };

  const calculateTVA = () => {
    return calculateSubtotal() * 0.2; // 20% TVA
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTVA();
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    if (!form.description) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir la description des travaux.",
        variant: "destructive",
      });
      return;
    }

    const validLines = lines.filter((l) => l.description && l.unit_price > 0);
    if (validLines.length === 0) {
      toast({
        title: "Lignes requises",
        description: "Ajoutez au moins une ligne au devis.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/provider/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.description,
          description: form.notes,
          valid_until: form.valid_until.toISOString().split("T")[0],
          items: validLines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unit: "unité",
            unit_price: line.unit_price,
            tax_rate: 20,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la création");
      }

      toast({
        title: asDraft ? "Brouillon sauvegardé" : "Devis créé",
        description: asDraft
          ? "Votre devis a été sauvegardé en brouillon."
          : "Le devis a été créé avec succès.",
      });

      router.push("/provider/quotes");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer le devis.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-slate-50 p-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/provider/quotes"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux devis
          </Link>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-orange-900 to-slate-900 bg-clip-text text-transparent">
            Nouveau devis
          </h1>
          <p className="text-muted-foreground mt-1">
            Créez un devis pour votre client
          </p>
        </div>

        <div className="space-y-6">
          {/* Informations client */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                Informations client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_name">Nom du client *</Label>
                  <Input
                    id="client_name"
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    placeholder="Jean Dupont"
                    className="bg-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_email">Email</Label>
                  <Input
                    id="client_email"
                    type="email"
                    value={form.client_email}
                    onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                    placeholder="client@email.fr"
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="property_address">Adresse du bien</Label>
                <Input
                  id="property_address"
                  value={form.property_address}
                  onChange={(e) => setForm({ ...form, property_address: e.target.value })}
                  placeholder="12 rue de la Paix, 75002 Paris"
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description des travaux *</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Réparation fuite salle de bain"
                  className="bg-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Date de validité</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full md:w-auto justify-start text-left font-normal bg-white"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(form.valid_until, "PPP", { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.valid_until}
                      onSelect={(date) => date && setForm({ ...form, valid_until: date })}
                      locale={fr}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Lignes du devis */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Euro className="h-5 w-5 text-orange-500" />
                  Détail du devis
                </CardTitle>
                <CardDescription>
                  Ajoutez les prestations et leur tarif
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground">
                <div className="col-span-6">Description</div>
                <div className="col-span-2">Quantité</div>
                <div className="col-span-2">Prix unitaire</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>

              {/* Lines */}
              {lines.map((line, index) => (
                <div
                  key={line.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 md:p-0 bg-slate-50 md:bg-transparent rounded-lg md:rounded-none"
                >
                  <div className="md:col-span-6 space-y-1">
                    <Label className="md:hidden">Description</Label>
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(line.id, "description", e.target.value)}
                      placeholder="Description de la prestation"
                      className="bg-white"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="md:hidden">Quantité</Label>
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, "quantity", parseInt(e.target.value) || 1)}
                      className="bg-white"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="md:hidden">Prix unitaire (€)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => updateLine(line.id, "unit_price", parseFloat(e.target.value) || 0)}
                      className="bg-white"
                    />
                  </div>
                  <div className="md:col-span-1 text-right font-medium">
                    {(line.quantity * line.unit_price).toLocaleString("fr-FR")} €
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(line.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Totaux */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total HT</span>
                  <span className="font-medium">{calculateSubtotal().toLocaleString("fr-FR")} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA (20%)</span>
                  <span className="font-medium">{calculateTVA().toLocaleString("fr-FR")} €</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total TTC</span>
                  <span className="text-orange-600">{calculateTotal().toLocaleString("fr-FR")} €</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Notes et conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Conditions de paiement, délais d'intervention, garanties..."
                rows={4}
                className="bg-white resize-none"
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button variant="outline" asChild>
              <Link href="/provider/quotes">Annuler</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit(true)}
              disabled={loading}
            >
              <Save className="mr-2 h-4 w-4" />
              Sauvegarder brouillon
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Envoyer le devis
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

