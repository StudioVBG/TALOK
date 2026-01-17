"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  ArrowLeft,
  Send,
  Wrench,
  Droplet,
  Zap,
  Thermometer,
  Lock,
  HelpCircle,
  Building2,
  Loader2,
  CheckCircle2,
  Info,
  AlertTriangle,
  Euro,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const categories = [
  { value: "plomberie", label: "Plomberie", icon: Droplet, color: "text-blue-500" },
  { value: "electricite", label: "Électricité", icon: Zap, color: "text-yellow-500" },
  { value: "chauffage", label: "Chauffage/Climatisation", icon: Thermometer, color: "text-orange-500" },
  { value: "serrurerie", label: "Serrurerie", icon: Lock, color: "text-slate-500" },
  { value: "autre", label: "Autre", icon: HelpCircle, color: "text-purple-500" },
];

const priorities = [
  { value: "basse", label: "Basse", description: "Peut attendre quelques semaines", color: "bg-slate-100 text-slate-700", hasFees: false },
  { value: "normale", label: "Normale", description: "À traiter dans la semaine", color: "bg-blue-100 text-blue-700", hasFees: false },
  { value: "haute", label: "Haute", description: "Urgent - sous 48h", color: "bg-orange-100 text-orange-700", hasFees: false },
  { 
    value: "urgente", 
    label: "Urgente", 
    description: "Intervention immédiate", 
    color: "bg-red-100 text-red-700",
    hasFees: true,
    feesInfo: {
      label: "Frais supplémentaires",
      details: [
        "Majoration intervention urgente : +50%",
        "Déplacement en urgence : 45€ - 80€",
        "Intervention week-end/jour férié : +100%",
        "Astreinte nuit (22h-7h) : +75€"
      ]
    }
  },
];

interface Property {
  id: string;
  adresse_complete?: string;
  type?: string;
}

export default function NewOwnerTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);

  const preselectedPropertyId = searchParams.get("propertyId");

  const [form, setForm] = useState({
    titre: "",
    description: "",
    categorie: "",
    priorite: "normale",
    property_id: preselectedPropertyId || "",
  });

  // Charger les propriétés
  useEffect(() => {
    async function fetchProperties() {
      try {
        const response = await fetch("/api/properties");
        if (response.ok) {
          const data = await response.json();
          setProperties(data.properties || data || []);
        }
      } catch (error) {
        console.error("Erreur chargement propriétés:", error);
      } finally {
        setLoadingProperties(false);
      }
    }
    fetchProperties();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.titre || !form.description || !form.property_id || !form.categorie) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires (bien, titre, catégorie, description).",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: form.titre,
          description: form.description,
          priorite: form.priorite,
          categorie: form.categorie || "autre",
          property_id: form.property_id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error instanceof Error ? error.message : "Erreur lors de la création");
      }

      toast({
        title: "Ticket créé !",
        description: "Votre ticket a été créé avec succès.",
      });

      router.push("/owner/tickets");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer le ticket.",
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
      className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen"
    >
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/owner/tickets"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux tickets
          </Link>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
            Nouveau ticket
          </h1>
          <p className="text-muted-foreground mt-1">
            Créez un ticket pour signaler un problème ou planifier une intervention
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-600" />
              Détails du ticket
            </CardTitle>
            <CardDescription>
              Remplissez les informations pour créer votre ticket
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Sélection du bien */}
              <div className="space-y-2">
                <Label htmlFor="property_id" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Bien concerné *
                </Label>
                <Select
                  value={form.property_id}
                  onValueChange={(value) => setForm({ ...form, property_id: value })}
                  disabled={loadingProperties}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={loadingProperties ? "Chargement..." : "Sélectionner un bien"} />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.adresse_complete || `Bien ${property.type || ""}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Titre */}
              <div className="space-y-2">
                <Label htmlFor="titre">Titre *</Label>
                <Input
                  id="titre"
                  placeholder="Ex: Fuite d'eau dans la salle de bain"
                  value={form.titre}
                  onChange={(e) => setForm({ ...form, titre: e.target.value })}
                  className="bg-white"
                  required
                />
              </div>

              {/* Catégorie et Priorité */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Catégorie <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = form.categorie === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setForm({ ...form, categorie: cat.value })}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          )}
                        >
                          <Icon className={cn("h-5 w-5", isSelected ? "text-blue-600" : cat.color)} />
                          <span className="text-xs font-medium">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Priorité *</Label>
                  <TooltipProvider>
                    <Select
                      value={form.priorite}
                      onValueChange={(value) => setForm({ ...form, priorite: value })}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <div className="flex items-center gap-2">
                              <span className={cn("px-2 py-0.5 rounded text-xs font-medium", p.color)}>
                                {p.label}
                              </span>
                              <span className="text-muted-foreground text-sm">{p.description}</span>
                              {p.hasFees && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium cursor-help">
                                      <Euro className="h-3 w-3" />
                                      Frais
                                      <Info className="h-3 w-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs p-3">
                                    <p className="font-semibold text-amber-700 mb-2 flex items-center gap-1">
                                      <AlertTriangle className="h-4 w-4" />
                                      {p.feesInfo?.label}
                                    </p>
                                    <ul className="space-y-1 text-sm">
                                      {p.feesInfo?.details.map((detail, i) => (
                                        <li key={i} className="flex items-start gap-1">
                                          <span className="text-amber-500">•</span>
                                          {detail}
                                        </li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TooltipProvider>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez le problème en détail : localisation exacte, depuis quand, urgence..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={5}
                  className="bg-white resize-none"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Plus la description est précise, plus l'intervention sera efficace.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Créer le ticket
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

