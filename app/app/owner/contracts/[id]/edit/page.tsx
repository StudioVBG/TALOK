"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  FileText,
  Euro,
  CalendarIcon,
  Save,
  Loader2,
  Building2,
  User,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Lease {
  id: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  depot_garantie: number;
  date_debut: string;
  date_fin?: string;
  statut: string;
  property?: {
    id: string;
    adresse_complete: string;
  };
  tenant?: {
    prenom: string;
    nom: string;
  };
  clauses_particulieres?: string;
}

const bailTypes = [
  { value: "nu", label: "Location nue" },
  { value: "meuble", label: "Location meublée" },
  { value: "colocation", label: "Colocation" },
  { value: "saisonnier", label: "Location saisonnière" },
];

export default function EditLeasePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const leaseId = params.id as string;

  const [lease, setLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchLease() {
      try {
        const response = await fetch(`/api/leases/${leaseId}`);
        if (response.ok) {
          const data = await response.json();
          setLease(data.lease || data);
        }
      } catch (error) {
        console.error("Erreur chargement bail:", error);
      } finally {
        setLoading(false);
      }
    }
    if (leaseId) fetchLease();
  }, [leaseId]);

  const handleSave = async () => {
    if (!lease) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_bail: lease.type_bail,
          loyer: lease.loyer,
          charges_forfaitaires: lease.charges_forfaitaires,
          depot_garantie: lease.depot_garantie,
          date_debut: lease.date_debut,
          date_fin: lease.date_fin,
          clauses_particulieres: lease.clauses_particulieres,
        }),
      });

      if (!response.ok) throw new Error("Erreur sauvegarde");

      toast({
        title: "Bail mis à jour",
        description: "Les modifications ont été enregistrées.",
      });

      router.push(`/app/owner/contracts/${leaseId}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les modifications.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="p-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Bail introuvable</h3>
            <Button asChild>
              <Link href="/app/owner/contracts">Retour aux baux</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen"
    >
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/app/owner/contracts/${leaseId}`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au bail
          </Link>

          <h1 className="text-2xl font-bold">Modifier le bail</h1>
          {lease.property && (
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {lease.property.adresse_complete}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Type de bail */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Type de bail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={lease.type_bail}
                onValueChange={(value) => setLease({ ...lease, type_bail: value })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bailTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Montants */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5 text-blue-500" />
                Montants
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loyer">Loyer mensuel (€)</Label>
                  <Input
                    id="loyer"
                    type="number"
                    min="0"
                    step="0.01"
                    value={lease.loyer}
                    onChange={(e) => setLease({ ...lease, loyer: parseFloat(e.target.value) || 0 })}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="charges">Charges (€)</Label>
                  <Input
                    id="charges"
                    type="number"
                    min="0"
                    step="0.01"
                    value={lease.charges_forfaitaires}
                    onChange={(e) => setLease({ ...lease, charges_forfaitaires: parseFloat(e.target.value) || 0 })}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depot">Dépôt de garantie (€)</Label>
                  <Input
                    id="depot"
                    type="number"
                    min="0"
                    step="0.01"
                    value={lease.depot_garantie}
                    onChange={(e) => setLease({ ...lease, depot_garantie: parseFloat(e.target.value) || 0 })}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Total mensuel:</strong>{" "}
                  {(lease.loyer + lease.charges_forfaitaires).toLocaleString("fr-FR")} €
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-blue-500" />
                Durée du bail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white",
                          !lease.date_debut && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {lease.date_debut
                          ? format(new Date(lease.date_debut), "PPP", { locale: fr })
                          : "Sélectionner"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(lease.date_debut)}
                        onSelect={(date) =>
                          date && setLease({ ...lease, date_debut: date.toISOString() })
                        }
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Date de fin (optionnelle)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white",
                          !lease.date_fin && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {lease.date_fin
                          ? format(new Date(lease.date_fin), "PPP", { locale: fr })
                          : "Non définie"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={lease.date_fin ? new Date(lease.date_fin) : undefined}
                        onSelect={(date) =>
                          setLease({ ...lease, date_fin: date?.toISOString() })
                        }
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clauses particulières */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Clauses particulières</CardTitle>
              <CardDescription>
                Ajoutez des clauses spécifiques à ce bail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={lease.clauses_particulieres || ""}
                onChange={(e) => setLease({ ...lease, clauses_particulieres: e.target.value })}
                placeholder="Clauses particulières, conditions spéciales..."
                rows={5}
                className="bg-white resize-none"
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" asChild>
              <Link href={`/app/owner/contracts/${leaseId}`}>Annuler</Link>
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Sauvegarder
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

