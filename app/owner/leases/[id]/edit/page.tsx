"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  ExternalLink,
  AlertCircle,
  CreditCard,
  ScrollText,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Lease {
  id: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  depot_garantie: number;
  date_debut: string;
  date_fin?: string;
  statut: string;
  indice_reference?: string;
  // Nouveaux champs (optionnels si migration non appliquée)
  charges_type?: string;
  mode_paiement?: string;
  jour_paiement?: number;
  revision_autorisee?: boolean;
  clauses_particulieres?: string;
  property?: {
    id: string;
    adresse_complete: string;
  };
}

const bailTypes = [
  { value: "nu", label: "Location nue" },
  { value: "meuble", label: "Location meublée" },
  { value: "colocation", label: "Colocation" },
  { value: "saisonnier", label: "Location saisonnière" },
  { value: "bail_mobilite", label: "Bail mobilité" },
];

const chargesTypes = [
  { value: "forfait", label: "Forfait (montant fixe)" },
  { value: "provisions", label: "Provisions (régularisation annuelle)" },
];

const modesPaiement = [
  { value: "virement", label: "Virement bancaire" },
  { value: "prelevement", label: "Prélèvement automatique" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces" },
];

const joursPaiement = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}${i === 0 ? "er" : ""}`,
}));

// ✅ Calcul du dépôt max légal selon le type de bail
const getMaxDepotLegal = (typeBail: string, loyerHC: number): number => {
  switch (typeBail) {
    case "nu":
    case "etudiant":
      return loyerHC * 1; // 1 mois max légal
    case "meuble":
    case "colocation":
      return loyerHC * 2; // 2 mois max légal
    case "bail_mobilite":
    case "mobilite":
      return 0; // Interdit par la loi
    case "saisonnier":
      return loyerHC * 2;
    default:
      return loyerHC;
  }
};

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
          const leaseData = data.lease || data;
          setLease({
            ...leaseData,
            indice_reference: leaseData.indice_reference || "IRL",
            // Valeurs par défaut pour les nouveaux champs
            charges_type: leaseData.charges_type || "forfait",
            mode_paiement: leaseData.mode_paiement || "virement",
            jour_paiement: leaseData.jour_paiement || 5,
            revision_autorisee: leaseData.revision_autorisee ?? true,
            clauses_particulieres: leaseData.clauses_particulieres || "",
          });
        }
      } catch (error) {
        console.error("Erreur chargement bail:", error);
      } finally {
        setLoading(false);
      }
    }
    if (leaseId) fetchLease();
  }, [leaseId]);

  // ✅ Calcul du max légal actuel (pour affichage)
  const maxDepotLegal = lease ? getMaxDepotLegal(lease.type_bail, lease.loyer || 0) : 0;

  // ✅ Changement de type de bail (seule modification autorisée sur les montants)
  const handleTypeBailChange = (newType: string) => {
    if (!lease) return;
    setLease({ ...lease, type_bail: newType });
  };

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
          indice_reference: "IRL",
          // Nouveaux champs
          charges_type: lease.charges_type,
          mode_paiement: lease.mode_paiement,
          jour_paiement: lease.jour_paiement,
          revision_autorisee: lease.revision_autorisee,
          clauses_particulieres: lease.clauses_particulieres,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur sauvegarde");
      }

      toast({
        title: "Bail mis à jour",
        description: "Les modifications ont été enregistrées.",
      });

      router.push(`/owner/leases/${leaseId}`);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder les modifications.",
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
              <Link href="/owner/leases">Retour aux baux</Link>
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
            href={`/owner/leases/${leaseId}`}
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
          {/* Lien vers modification du logement */}
          {lease.property && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-blue-700">
                  Pour modifier les caractéristiques du logement (surface, étage, chauffage...), 
                  modifiez la fiche du bien.
                </span>
                <Button variant="outline" size="sm" asChild className="ml-4 shrink-0">
                  <Link href={`/owner/properties/${lease.property.id}`}>
                    Voir le logement
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Type de bail */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Type de bail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={lease.type_bail}
                onValueChange={handleTypeBailChange}
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

              {/* Indice de révision IRL */}
              <div className="p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Indice de révision</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Applicable aux baux d'habitation
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                    IRL
                  </span>
                </div>
              </div>

              {/* Révision autorisée */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Révision annuelle du loyer</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Autoriser la révision selon l'IRL
                  </p>
                </div>
                <Switch
                  checked={lease.revision_autorisee ?? true}
                  onCheckedChange={(checked) =>
                    setLease({ ...lease, revision_autorisee: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Montants (lecture seule - viennent du BIEN) */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5 text-blue-500" />
                Montants
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info : les montants viennent du bien */}
              <Alert>
                <AlertDescription className="text-sm">
                  Les montants sont gérés depuis la fiche du bien. Pour les modifier, 
                  <a 
                    href={`/owner/properties/${lease.property?.id}`} 
                    className="text-blue-600 hover:underline ml-1 font-medium"
                  >
                    accédez à la page du bien →
                  </a>
                </AlertDescription>
              </Alert>

              {/* Affichage en lecture seule */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Loyer mensuel HC</p>
                  <p className="text-xl font-bold">{lease.loyer?.toLocaleString("fr-FR")} €</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Charges</p>
                  <p className="text-xl font-bold">{lease.charges_forfaitaires?.toLocaleString("fr-FR")} €</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Dépôt de garantie</p>
                  <p className="text-xl font-bold">{lease.depot_garantie?.toLocaleString("fr-FR")} €</p>
                  <p className="text-xs text-muted-foreground">Max légal : {maxDepotLegal.toLocaleString("fr-FR")} €</p>
                </div>
              </div>
              
              {/* Récapitulatif */}
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-sm font-medium text-blue-900">
                  Total mensuel : {((lease.loyer || 0) + (lease.charges_forfaitaires || 0)).toLocaleString("fr-FR")} €
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  1er versement : {((lease.loyer || 0) + (lease.charges_forfaitaires || 0) + (lease.depot_garantie || 0)).toLocaleString("fr-FR")} € (loyer + charges + dépôt)
                </p>
              </div>

              {/* Type de charges */}
              <div className="space-y-2">
                <Label>Type de charges</Label>
                <Select
                  value={lease.charges_type || "forfait"}
                  onValueChange={(value) => setLease({ ...lease, charges_type: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {chargesTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {lease.charges_type === "provisions"
                    ? "Les charges seront régularisées annuellement selon les dépenses réelles."
                    : "Le montant des charges est fixe et ne sera pas régularisé."}
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Total mensuel:</strong>{" "}
                  {(lease.loyer + lease.charges_forfaitaires).toLocaleString("fr-FR")} €
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Paiement */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-500" />
                Modalités de paiement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mode de paiement</Label>
                  <Select
                    value={lease.mode_paiement || "virement"}
                    onValueChange={(value) => setLease({ ...lease, mode_paiement: value })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modesPaiement.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jour de paiement</Label>
                  <Select
                    value={String(lease.jour_paiement || 5)}
                    onValueChange={(value) => setLease({ ...lease, jour_paiement: parseInt(value) })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {joursPaiement.map((jour) => (
                        <SelectItem key={jour.value} value={jour.value}>
                          Le {jour.label} du mois
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-blue-500" />
                Clauses particulières
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ajoutez ici les clauses particulières du bail (interdiction de fumer, animaux, travaux autorisés, etc.)"
                value={lease.clauses_particulieres || ""}
                onChange={(e) => setLease({ ...lease, clauses_particulieres: e.target.value })}
                className="min-h-[120px] bg-white"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Ces clauses seront ajoutées au contrat de bail.
              </p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" asChild>
              <Link href={`/owner/leases/${leaseId}`}>Annuler</Link>
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
