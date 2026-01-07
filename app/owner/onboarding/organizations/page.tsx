"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  User,
  Plus,
  ChevronRight,
  Check,
  AlertCircle,
  Briefcase,
  HelpCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { OrganizationType } from "@/lib/types/multi-company";
import { ORGANIZATION_TYPE_LABELS } from "@/lib/types/multi-company";

// Types d'organisation groupés pour l'UI
const ORGANIZATION_OPTIONS = [
  {
    group: "Personnel",
    description: "Biens détenus en votre nom",
    options: [
      {
        value: "particulier" as const,
        label: "Nom propre",
        description: "Propriétaire particulier sans structure juridique",
        icon: User,
        color: "bg-slate-100 text-slate-700 border-slate-200",
        helpText: "Revenus fonciers déclarés sur votre impôt personnel",
      },
    ],
  },
  {
    group: "Sociétés civiles",
    description: "Structures dédiées à la gestion immobilière",
    options: [
      {
        value: "sci_ir" as const,
        label: "SCI à l'IR",
        description: "Société Civile Immobilière à l'Impôt sur le Revenu",
        icon: Building2,
        color: "bg-blue-50 text-blue-700 border-blue-200",
        helpText: "Transparence fiscale : les revenus sont imposés au niveau des associés",
        popular: true,
      },
      {
        value: "sci_is" as const,
        label: "SCI à l'IS",
        description: "Société Civile Immobilière à l'Impôt sur les Sociétés",
        icon: Building2,
        color: "bg-indigo-50 text-indigo-700 border-indigo-200",
        helpText: "La société paie l'IS, possibilité d'amortissement du bien",
      },
    ],
  },
  {
    group: "Sociétés commerciales",
    description: "Structures d'entreprise",
    options: [
      {
        value: "sarl_famille" as const,
        label: "SARL de famille",
        description: "SARL entre membres d'une même famille",
        icon: Briefcase,
        color: "bg-purple-50 text-purple-700 border-purple-200",
        helpText: "Option IR possible, protection du patrimoine",
      },
      {
        value: "sas" as const,
        label: "SAS",
        description: "Société par Actions Simplifiée",
        icon: Briefcase,
        color: "bg-violet-50 text-violet-700 border-violet-200",
        helpText: "Grande flexibilité statutaire, soumise à l'IS",
      },
    ],
  },
  {
    group: "Location meublée",
    description: "Statuts spécifiques pour le meublé",
    options: [
      {
        value: "lmnp" as const,
        label: "LMNP",
        description: "Loueur Meublé Non Professionnel",
        icon: Building2,
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        helpText: "Revenus < 23 000€/an ou < 50% des revenus du foyer",
        popular: true,
      },
      {
        value: "lmp" as const,
        label: "LMP",
        description: "Loueur Meublé Professionnel",
        icon: Building2,
        color: "bg-teal-50 text-teal-700 border-teal-200",
        helpText: "Revenus > 23 000€/an ET > 50% des revenus du foyer",
      },
    ],
  },
  {
    group: "Autres structures",
    description: "Situations particulières",
    options: [
      {
        value: "indivision" as const,
        label: "Indivision",
        description: "Propriété partagée entre plusieurs personnes",
        icon: User,
        color: "bg-amber-50 text-amber-700 border-amber-200",
        helpText: "Héritage ou achat à plusieurs sans création de société",
      },
      {
        value: "usufruit" as const,
        label: "Usufruitier",
        description: "Droit d'usage et de percevoir les revenus",
        icon: User,
        color: "bg-orange-50 text-orange-700 border-orange-200",
        helpText: "Démembrement de propriété : vous percevez les loyers",
      },
      {
        value: "nue_propriete" as const,
        label: "Nu-propriétaire",
        description: "Propriétaire sans jouissance immédiate",
        icon: User,
        color: "bg-rose-50 text-rose-700 border-rose-200",
        helpText: "Propriété sans revenus jusqu'à extinction de l'usufruit",
      },
    ],
  },
];

interface OrganizationFormData {
  nom_entite: string;
  type: OrganizationType;
  siret?: string;
  siren?: string;
}

export default function OrganizationsOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<"intro" | "count" | "add" | "review">("intro");
  const [hasMultiple, setHasMultiple] = useState<boolean | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationFormData[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrganizationFormData>({
    nom_entite: "",
    type: "particulier",
  });
  const [loading, setLoading] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  };

  // Ajouter une organisation à la liste
  const addOrganization = () => {
    if (!currentOrg.nom_entite.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez saisir un nom pour cette organisation",
        variant: "destructive",
      });
      return;
    }

    setOrganizations([...organizations, { ...currentOrg }]);
    setCurrentOrg({ nom_entite: "", type: "particulier" });

    if (!hasMultiple) {
      // Si mono-organisation, passer directement à la review
      setStep("review");
    }
  };

  // Sauvegarder et continuer
  const handleSubmit = async () => {
    setLoading(true);

    try {
      // Ajouter l'organisation courante si elle a un nom
      const orgsToCreate = currentOrg.nom_entite.trim()
        ? [...organizations, currentOrg]
        : organizations;

      if (orgsToCreate.length === 0) {
        toast({
          title: "Aucune organisation",
          description: "Veuillez ajouter au moins une organisation",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Créer les organisations via l'API
      for (const org of orgsToCreate) {
        const response = await fetch("/api/owner/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(org),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Erreur lors de la création");
        }
      }

      toast({
        title: "Organisations créées !",
        description: `${orgsToCreate.length} organisation(s) configurée(s) avec succès`,
      });

      // Marquer l'étape comme complétée et rediriger
      router.push("/owner/onboarding/property");
    } catch (error: any) {
      console.error("Erreur création organisations:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Skip - créer juste l'organisation par défaut
  const handleSkip = async () => {
    setLoading(true);
    try {
      // L'organisation par défaut est créée automatiquement par le trigger
      toast({
        title: "Configuration simplifiée",
        description: "Vous pourrez ajouter des sociétés plus tard",
      });
      router.push("/owner/onboarding/property");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4">
            Étape 2/5
          </Badge>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Vos structures de détention
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto">
            Possédez-vous des biens via plusieurs sociétés ou structures juridiques ?
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* Étape 1: Introduction / Question initiale */}
          {step === "intro" && (
            <motion.div
              key="intro"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Card className="border-2 border-slate-100">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">
                    Comment détenez-vous vos biens immobiliers ?
                  </CardTitle>
                  <CardDescription>
                    Cette information nous permet d'adapter la gestion de vos biens
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Option: Nom propre uniquement */}
                    <button
                      onClick={() => {
                        setHasMultiple(false);
                        setCurrentOrg({ nom_entite: "Personnel", type: "particulier" });
                        setStep("add");
                      }}
                      className="group p-6 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-slate-100 group-hover:bg-blue-100 transition-colors">
                          <User className="h-6 w-6 text-slate-600 group-hover:text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 mb-1">
                            En mon nom uniquement
                          </h3>
                          <p className="text-sm text-slate-600">
                            Je possède mes biens en nom propre, sans société
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Option: Plusieurs structures */}
                    <button
                      onClick={() => {
                        setHasMultiple(true);
                        setStep("add");
                      }}
                      className="group p-6 rounded-xl border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-slate-100 group-hover:bg-indigo-100 transition-colors">
                          <Building2 className="h-6 w-6 text-slate-600 group-hover:text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 mb-1">
                            Plusieurs structures
                          </h3>
                          <p className="text-sm text-slate-600">
                            J'ai des SCI, SARL, LMNP ou biens en nom propre
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>Exemple :</strong> 2 SCI avec 5 biens chacune + 3 biens en nom propre
                      = 3 organisations à créer
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-center pt-4">
                    <Button variant="ghost" onClick={handleSkip} disabled={loading}>
                      Passer cette étape
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Étape 2: Ajout d'organisations */}
          {step === "add" && (
            <motion.div
              key="add"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6"
            >
              {/* Liste des organisations ajoutées */}
              {organizations.length > 0 && (
                <Card className="border-green-200 bg-green-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Organisations ajoutées ({organizations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {organizations.map((org, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="py-1.5 px-3"
                        >
                          {org.nom_entite}
                          <span className="ml-2 text-xs opacity-60">
                            {ORGANIZATION_TYPE_LABELS[org.type]}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Formulaire d'ajout */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {hasMultiple
                      ? `Ajouter une organisation ${organizations.length > 0 ? "(optionnel)" : ""}`
                      : "Confirmez votre structure"}
                  </CardTitle>
                  <CardDescription>
                    {hasMultiple
                      ? "Ajoutez vos SCI, SARL, ou autres structures de détention"
                      : "Nous avons pré-rempli pour une détention en nom propre"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Nom de l'organisation */}
                  <div className="space-y-2">
                    <Label htmlFor="nom_entite">
                      Nom de l'organisation / structure
                    </Label>
                    <Input
                      id="nom_entite"
                      placeholder={
                        currentOrg.type === "particulier"
                          ? "Ex: Patrimoine personnel"
                          : "Ex: SCI Les Oliviers"
                      }
                      value={currentOrg.nom_entite}
                      onChange={(e) =>
                        setCurrentOrg({ ...currentOrg, nom_entite: e.target.value })
                      }
                    />
                  </div>

                  {/* Type d'organisation */}
                  <div className="space-y-3">
                    <Label>Type de structure</Label>
                    <TooltipProvider>
                      <div className="space-y-3">
                        {ORGANIZATION_OPTIONS.map((group) => (
                          <Collapsible
                            key={group.group}
                            open={
                              expandedGroup === group.group ||
                              group.options.some((o) => o.value === currentOrg.type)
                            }
                            onOpenChange={(open) =>
                              setExpandedGroup(open ? group.group : null)
                            }
                          >
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-slate-50 hover:bg-slate-100 transition-colors">
                              <div className="text-left">
                                <div className="font-medium text-sm">
                                  {group.group}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {group.description}
                                </div>
                              </div>
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  (expandedGroup === group.group ||
                                    group.options.some(
                                      (o) => o.value === currentOrg.type
                                    )) &&
                                    "rotate-90"
                                )}
                              />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-2">
                              <RadioGroup
                                value={currentOrg.type}
                                onValueChange={(value) =>
                                  setCurrentOrg({
                                    ...currentOrg,
                                    type: value as OrganizationType,
                                  })
                                }
                                className="grid gap-2 pl-2"
                              >
                                {group.options.map((option) => {
                                  const Icon = option.icon;
                                  return (
                                    <div key={option.value}>
                                      <label
                                        htmlFor={option.value}
                                        className={cn(
                                          "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                                          currentOrg.type === option.value
                                            ? `${option.color} border-current`
                                            : "border-slate-200 hover:border-slate-300"
                                        )}
                                      >
                                        <RadioGroupItem
                                          value={option.value}
                                          id={option.value}
                                          className="sr-only"
                                        />
                                        <Icon className="h-5 w-5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                              {option.label}
                                            </span>
                                            {option.popular && (
                                              <Badge
                                                variant="secondary"
                                                className="text-xs"
                                              >
                                                Populaire
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-xs text-slate-500 truncate">
                                            {option.description}
                                          </p>
                                        </div>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent side="left" className="max-w-xs">
                                            {option.helpText}
                                          </TooltipContent>
                                        </Tooltip>
                                      </label>
                                    </div>
                                  );
                                })}
                              </RadioGroup>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </TooltipProvider>
                  </div>

                  {/* SIRET/SIREN pour les sociétés */}
                  {currentOrg.type !== "particulier" &&
                    currentOrg.type !== "indivision" &&
                    currentOrg.type !== "usufruit" &&
                    currentOrg.type !== "nue_propriete" && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="siren">SIREN (optionnel)</Label>
                          <Input
                            id="siren"
                            placeholder="123 456 789"
                            value={currentOrg.siren || ""}
                            onChange={(e) =>
                              setCurrentOrg({ ...currentOrg, siren: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="siret">SIRET (optionnel)</Label>
                          <Input
                            id="siret"
                            placeholder="123 456 789 00012"
                            value={currentOrg.siret || ""}
                            onChange={(e) =>
                              setCurrentOrg({ ...currentOrg, siret: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setStep("intro")}
                >
                  Retour
                </Button>

                <div className="flex gap-3">
                  {hasMultiple && organizations.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={addOrganization}
                      disabled={!currentOrg.nom_entite.trim()}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter une autre
                    </Button>
                  )}

                  <Button
                    onClick={
                      hasMultiple && currentOrg.nom_entite.trim()
                        ? () => {
                            addOrganization();
                            setStep("review");
                          }
                        : hasMultiple
                        ? () => setStep("review")
                        : addOrganization
                    }
                    disabled={
                      (!hasMultiple && !currentOrg.nom_entite.trim()) ||
                      (hasMultiple && organizations.length === 0 && !currentOrg.nom_entite.trim())
                    }
                  >
                    Continuer
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Étape 3: Review */}
          {step === "review" && (
            <motion.div
              key="review"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Card className="border-2 border-green-100">
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <CardTitle>Récapitulatif</CardTitle>
                  <CardDescription>
                    Vérifiez vos organisations avant de continuer
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="divide-y rounded-lg border">
                    {[...organizations, ...(currentOrg.nom_entite.trim() ? [currentOrg] : [])].map(
                      (org, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-100">
                              {org.type === "particulier" ? (
                                <User className="h-5 w-5" />
                              ) : (
                                <Building2 className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{org.nom_entite}</div>
                              <div className="text-sm text-slate-500">
                                {ORGANIZATION_TYPE_LABELS[org.type]}
                                {org.siret && ` - ${org.siret}`}
                              </div>
                            </div>
                          </div>
                          {idx === 0 && (
                            <Badge variant="secondary">Par défaut</Badge>
                          )}
                        </div>
                      )
                    )}
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Bon à savoir</AlertTitle>
                    <AlertDescription>
                      Vous pourrez ajouter ou modifier vos organisations à tout
                      moment depuis les paramètres de votre compte.
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setStep("add")}
                      className="flex-1"
                    >
                      Modifier
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? "Création..." : "Confirmer et continuer"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
