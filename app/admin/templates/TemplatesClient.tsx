"use client";
// @ts-nocheck

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Eye,
  Download,
  Edit3,
  Plus,
  Sparkles,
  Home,
  Sofa,
  Users,
  Sun,
  Briefcase,
  Check,
  Clock,
  AlertTriangle,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Printer,
  Copy,
  CheckCircle2,
  Settings,
  Layers,
  Scale,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { pdfService } from "@/lib/services/pdf.service";
import type { BailComplet, TypeBail } from "@/lib/templates/bail/types";

// Configuration des templates avec design
const TEMPLATE_CONFIGS = {
  nu: {
    name: "Location Vide",
    description: "Bail classique pour logement non meublé",
    icon: Home,
    gradient: "from-slate-600 via-slate-500 to-zinc-600",
    bgGradient: "from-slate-50 to-zinc-100 dark:from-slate-900/50 dark:to-zinc-900/50",
    accent: "#475569",
    accentLight: "#94a3b8",
    features: [
      { label: "Durée minimum", value: "3 ans", icon: Clock },
      { label: "Dépôt de garantie", value: "1 mois max", icon: Shield },
      { label: "Préavis locataire", value: "3 mois", icon: Scale },
    ],
    legalRef: "Loi 89-462, Décret 2015-587",
  },
  meuble: {
    name: "Location Meublée",
    description: "Logement équipé selon décret 2015-981",
    icon: Sofa,
    gradient: "from-blue-600 via-cyan-500 to-teal-500",
    bgGradient: "from-blue-50 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50",
    accent: "#0891b2",
    accentLight: "#22d3ee",
    features: [
      { label: "Durée minimum", value: "1 an", icon: Clock },
      { label: "Dépôt de garantie", value: "2 mois max", icon: Shield },
      { label: "Inventaire", value: "Obligatoire", icon: Layers },
    ],
    legalRef: "Décret 2015-981, Art. 25-4",
  },
  colocation: {
    name: "Colocation",
    description: "Bail unique ou individuel avec clause solidarité",
    icon: Users,
    gradient: "from-violet-600 via-purple-500 to-fuchsia-500",
    bgGradient: "from-violet-50 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50",
    accent: "#8b5cf6",
    accentLight: "#c4b5fd",
    features: [
      { label: "Clause solidarité", value: "Max 6 mois", icon: Scale },
      { label: "Quote-parts", value: "Personnalisables", icon: Settings },
      { label: "Signatures", value: "Multi-parties", icon: FileText },
    ],
    legalRef: "Art. 8-1 Loi 1989",
  },
  saisonnier: {
    name: "Saisonnier",
    description: "Location courte durée non principale",
    icon: Sun,
    gradient: "from-amber-500 via-orange-500 to-red-500",
    bgGradient: "from-amber-50 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50",
    accent: "#f59e0b",
    accentLight: "#fcd34d",
    features: [
      { label: "Durée maximum", value: "90 jours", icon: Clock },
      { label: "Taxe séjour", value: "Applicable", icon: Scale },
      { label: "Arrhes", value: "Personnalisables", icon: Shield },
    ],
    legalRef: "Art. 1-1 Loi 1989",
  },
  mobilite: {
    name: "Bail Mobilité",
    description: "Location temporaire pour personnes en mobilité",
    icon: Home,
    gradient: "from-indigo-600 via-purple-500 to-pink-500",
    bgGradient: "from-indigo-50 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50",
    accent: "#6366f1",
    accentLight: "#a5b4fc",
    features: [
      { label: "Durée", value: "1-10 mois", icon: Clock },
      { label: "Dépôt de garantie", value: "Interdit", icon: Shield },
      { label: "Renouvellement", value: "Non renouvelable", icon: Scale },
    ],
    legalRef: "Loi ELAN 2018",
  },
} as const;

interface LeaseTemplate {
  id: string;
  name: string;
  type_bail: TypeBail;
  template_content: string;
  variables: Record<string, unknown>;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplatesClientProps {
  templates: LeaseTemplate[];
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const cardHoverVariants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -8, transition: { type: "spring" as const, stiffness: 400 } },
};

export function TemplatesClient({ templates }: TemplatesClientProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TypeBail | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testFormOpen, setTestFormOpen] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [updatingLegislation, setUpdatingLegislation] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("Aujourd'hui");
  const { toast } = useToast();

  // Fonction pour mettre à jour toutes les législations
  const handleUpdateLegislation = useCallback(async () => {
    setUpdatingLegislation(true);
    try {
      const response = await fetch("/api/admin/templates/update-legislation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Mise à jour manuelle des législations par l'administrateur",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Échec de la mise à jour");
      }

      const data = await response.json();

      toast({
        title: "✨ Mise à jour réussie",
        description: (
          <div className="space-y-1 text-sm mt-2">
            <p>• <strong>{data.stats.templates_updated}</strong> template(s) mis à jour</p>
            <p>• <strong>{data.stats.leases_directly_updated}</strong> bail(s) brouillon mis à jour</p>
            {data.stats.active_leases_with_pending_updates > 0 && (
              <p>• <strong>{data.stats.active_leases_with_pending_updates}</strong> bail(s) actif(s) avec notifications</p>
            )}
            {data.stats.notifications_sent > 0 && (
              <p>• <strong>{data.stats.notifications_sent}</strong> notification(s) envoyée(s)</p>
            )}
          </div>
        ),
      });

      setLastUpdate("À l'instant");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour les législations",
        variant: "destructive",
      });
    } finally {
      setUpdatingLegislation(false);
    }
  }, [toast]);

  // Données de test pour la génération
  const [testData, setTestData] = useState<Partial<BailComplet>>({
    reference: `BAIL-TEST-${Date.now()}`,
    date_signature: new Date().toISOString().split("T")[0],
    lieu_signature: "Paris",
    bailleur: {
      nom: "Dupont",
      prenom: "Jean",
      adresse: "15 rue de la Paix",
      code_postal: "75002",
      ville: "Paris",
      type: "particulier",
      est_mandataire: false,
    },
    locataires: [
      {
        nom: "Martin",
        prenom: "Marie",
        date_naissance: "1990-05-15",
        lieu_naissance: "Lyon",
        nationalite: "Française",
      },
    ],
    logement: {
      adresse_complete: "25 avenue des Champs-Élysées",
      code_postal: "75008",
      ville: "Paris",
      type: "appartement",
      surface_habitable: 65,
      nb_pieces_principales: 3,
      regime: "copropriete",
      equipements_privatifs: ["Cuisine équipée", "Salle de bain", "Balcon"],
      annexes: [{ type: "cave", surface: 5 }],
    },
    conditions: {
      type_bail: "meuble",
      usage: "habitation_principale",
      date_debut: new Date().toISOString().split("T")[0],
      duree_mois: 12,
      tacite_reconduction: true,
      loyer_hc: 1200,
      loyer_en_lettres: "mille deux cents euros",
      charges_type: "provisions",
      charges_montant: 150,
      depot_garantie: 2400,
      depot_garantie_en_lettres: "deux mille quatre cents euros",
      mode_paiement: "virement",
      jour_paiement: 5,
      periodicite_paiement: "mensuelle",
      paiement_avance: true,
      revision_autorisee: true,
      indice_reference: "IRL",
    },
    diagnostics: {
      dpe: {
        date_realisation: "2024-01-15",
        date_validite: "2034-01-15",
        classe_energie: "C",
        classe_ges: "D",
        consommation_energie: 145,
        emissions_ges: 28,
        estimation_cout_min: 1200,
        estimation_cout_max: 1800,
      },
    },
    clauses: {
      activite_professionnelle_autorisee: false,
      animaux_autorises: true,
      sous_location_autorisee: false,
      travaux_autorises: false,
      assurance_obligatoire: true,
    },
  });

  // Générer la prévisualisation
  const handlePreview = useCallback(async (type: TypeBail) => {
    setSelectedTemplate(type);
    setGenerating(true);

    try {
      const updatedData = {
        ...testData,
        conditions: { 
          ...(testData.conditions || {}), 
          type_bail: type,
          usage: testData.conditions?.usage || "habitation_principale",
        },
      };
      const html = pdfService.previewLease(type, updatedData as any);
      setGeneratedHtml(html);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Erreur prévisualisation:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer la prévisualisation",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [testData, toast]);

  // Imprimer
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(generatedHtml);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Copier le HTML
  const handleCopyHtml = () => {
    navigator.clipboard.writeText(generatedHtml);
    toast({
      title: "Copié !",
      description: "Le HTML a été copié dans le presse-papiers",
    });
  };

  // Stats des templates avec action de mise à jour
  const stats = [
    {
      label: "Templates actifs",
      value: templates.filter((t) => t.is_active).length,
      icon: CheckCircle2,
      color: "text-green-500",
    },
    {
      label: "Types de bail",
      value: Object.keys(TEMPLATE_CONFIGS).length,
      icon: Layers,
      color: "text-blue-500",
    },
    {
      label: "Conformité",
      value: "100%",
      icon: Shield,
      color: "text-purple-500",
    },
    {
      label: "Dernière MAJ",
      value: lastUpdate,
      icon: Zap,
      color: "text-amber-500",
      onClick: handleUpdateLegislation,
      loading: updatingLegislation,
      tooltip: "Mettre à jour toutes les législations",
    },
  ] as const;

  return (
    <div className="min-h-screen">
      {/* Background avec effet de grain */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-50" />
      </div>

      <motion.div
        className="relative p-6 lg:p-8 space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header avec effet glassmorphism */}
        <motion.div variants={itemVariants} className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-2xl" />
          <div className="relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/20 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-50" />
                  <div className="relative p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
                    <FileText className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
                    Templates de Bail
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Modèles conformes à la loi ALUR et aux décrets 2015-587 / 2015-981
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setTestFormOpen(true)}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Données de test
                </Button>
                <Button className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Plus className="h-4 w-4" />
                  Nouveau template
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            const isClickable = "onClick" in stat && !!stat.onClick;
            const isLoading = "loading" in stat && stat.loading;

            return (
              <motion.div
                key={i}
                whileHover={{ y: -4, scale: isClickable ? 1.02 : 1 }}
                whileTap={isClickable ? { scale: 0.98 } : undefined}
                className={`relative group ${isClickable ? "cursor-pointer" : ""}`}
                onClick={isClickable ? stat.onClick : undefined}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                <div
                  className={`relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg rounded-2xl border border-white/20 p-5 transition-all duration-300 ${
                    isClickable
                      ? "hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/10"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div
                      className={`p-3 rounded-xl transition-all duration-300 ${stat.color} ${
                        isClickable
                          ? "bg-amber-100 dark:bg-amber-900/30 group-hover:scale-110 group-hover:rotate-12"
                          : "bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      {isLoading ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                  {isClickable && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Cliquez pour mettre à jour
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Template Cards Grid */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Types de contrats disponibles</h2>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Conforme loi ALUR
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {(Object.entries(TEMPLATE_CONFIGS) as [TypeBail, typeof TEMPLATE_CONFIGS.nu][]).map(
              ([type, config]) => {
                const Icon = config.icon;
                const dbTemplate = templates.find((t) => t.type_bail === type);

                return (
                  <motion.div
                    key={type}
                    variants={cardHoverVariants}
                    initial="rest"
                    whileHover="hover"
                    className="relative group cursor-pointer"
                    onClick={() => handlePreview(type)}
                  >
                    {/* Glow effect */}
                    <div
                      className="absolute -inset-1 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl"
                      style={{
                        background: `linear-gradient(135deg, ${config.accent}30, ${config.accentLight}20)`,
                      }}
                    />

                    {/* Card */}
                    <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-slate-700/50 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
                      {/* Header avec gradient */}
                      <div
                        className={`relative h-24 sm:h-32 bg-gradient-to-br ${config.gradient} flex items-center justify-center overflow-hidden`}
                      >
                        {/* Pattern de fond */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute inset-0" style={{
                            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                            backgroundSize: "24px 24px",
                          }} />
                        </div>

                        {/* Icon avec animation */}
                        <motion.div
                          animate={{
                            y: [0, -5, 0],
                            rotate: [0, 3, -3, 0],
                          }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="relative z-10"
                        >
                          <Icon className="h-14 w-14 text-white/90 drop-shadow-lg" />
                        </motion.div>

                        {/* Sparkle */}
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                          className="absolute top-4 right-4"
                        >
                          <Sparkles className="h-5 w-5 text-white/40" />
                        </motion.div>

                        {/* Badge version */}
                        {dbTemplate && (
                          <div className="absolute top-4 left-4">
                            <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                              v{dbTemplate.version}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 space-y-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {config.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {config.description}
                          </p>
                        </div>

                        {/* Features */}
                        <div className="space-y-2">
                          {config.features.map((feature, i) => {
                            const FeatureIcon = feature.icon;
                            return (
                              <div
                                key={i}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="flex items-center gap-2 text-muted-foreground">
                                  <FeatureIcon className="h-3.5 w-3.5" />
                                  {feature.label}
                                </span>
                                <span className="font-medium" style={{ color: config.accent }}>
                                  {feature.value}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <Separator />

                        {/* Legal ref */}
                        <p className="text-xs text-muted-foreground">
                          📋 {config.legalRef}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(type);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            Aperçu
                          </Button>
                          <Button
                            size="sm"
                            className={`flex-1 gap-1 bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white border-0`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(type);
                            }}
                          >
                            <Download className="h-4 w-4" />
                            Générer
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }
            )}
          </div>
        </motion.div>

        {/* Section informations légales */}
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200/50 dark:border-blue-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                <Scale className="h-5 w-5" />
                Conformité légale
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                Tous les templates respectent la législation française en vigueur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Loi ALUR (2014)</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Contrats types obligatoires, encadrement des loyers, clauses interdites
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Décret 2015-587</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Modèle de contrat type, mentions obligatoires, annexes requises
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Décret 2015-981</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Liste du mobilier obligatoire pour les locations meublées
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Modal de prévisualisation */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden flex flex-col gap-0">
          <DialogHeader className="p-6 pb-4 border-b bg-slate-50 dark:bg-slate-900 shrink-0">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-3">
                {selectedTemplate && (
                  <>
                    <div
                      className={`p-2 rounded-lg bg-gradient-to-br ${TEMPLATE_CONFIGS[selectedTemplate].gradient}`}
                    >
                      {(() => {
                        const Icon = TEMPLATE_CONFIGS[selectedTemplate].icon;
                        return <Icon className="h-5 w-5 text-white" />;
                      })()}
                    </div>
                    <div>
                      <DialogTitle>
                        Aperçu : {TEMPLATE_CONFIGS[selectedTemplate].name}
                      </DialogTitle>
                      <DialogDescription>
                        {TEMPLATE_CONFIGS[selectedTemplate].legalRef}
                      </DialogDescription>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyHtml}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copier HTML
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFullscreenPreview(!fullscreenPreview)}
                >
                  {fullscreenPreview ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden p-4 bg-slate-100 dark:bg-slate-950">
            {generating ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <iframe
                srcDoc={generatedHtml}
                className="w-full h-full bg-white rounded-lg shadow-lg border"
                title="Aperçu du bail"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal des données de test */}
      <Dialog open={testFormOpen} onOpenChange={setTestFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Données de test pour génération
            </DialogTitle>
            <DialogDescription>
              Modifiez ces données pour tester la génération des différents types de baux
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="bailleur" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="bailleur">Bailleur</TabsTrigger>
              <TabsTrigger value="locataire">Locataire</TabsTrigger>
              <TabsTrigger value="logement">Logement</TabsTrigger>
              <TabsTrigger value="conditions">Conditions</TabsTrigger>
            </TabsList>

            <TabsContent value="bailleur" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={testData.bailleur?.nom || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        bailleur: { ...testData.bailleur!, nom: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={testData.bailleur?.prenom || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        bailleur: { ...testData.bailleur!, prenom: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Adresse</Label>
                  <Input
                    value={testData.bailleur?.adresse || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        bailleur: { ...testData.bailleur!, adresse: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input
                    value={testData.bailleur?.code_postal || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        bailleur: { ...testData.bailleur!, code_postal: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input
                    value={testData.bailleur?.ville || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        bailleur: { ...testData.bailleur!, ville: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="locataire" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={testData.locataires?.[0]?.nom || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        locataires: [{ ...testData.locataires![0], nom: e.target.value }],
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={testData.locataires?.[0]?.prenom || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        locataires: [{ ...testData.locataires![0], prenom: e.target.value }],
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de naissance</Label>
                  <Input
                    type="date"
                    value={testData.locataires?.[0]?.date_naissance || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        locataires: [{ ...testData.locataires![0], date_naissance: e.target.value }],
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lieu de naissance</Label>
                  <Input
                    value={testData.locataires?.[0]?.lieu_naissance || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        locataires: [{ ...testData.locataires![0], lieu_naissance: e.target.value }],
                      })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="logement" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Adresse complète</Label>
                  <Input
                    value={testData.logement?.adresse_complete || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        logement: { ...testData.logement!, adresse_complete: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input
                    value={testData.logement?.code_postal || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        logement: { ...testData.logement!, code_postal: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input
                    value={testData.logement?.ville || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        logement: { ...testData.logement!, ville: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Surface (m²)</Label>
                  <Input
                    type="number"
                    value={testData.logement?.surface_habitable || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        logement: { ...testData.logement!, surface_habitable: Number(e.target.value) },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre de pièces</Label>
                  <Input
                    type="number"
                    value={testData.logement?.nb_pieces_principales || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        logement: { ...testData.logement!, nb_pieces_principales: Number(e.target.value) },
                      })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="conditions" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loyer HC (€)</Label>
                  <Input
                    type="number"
                    value={testData.conditions?.loyer_hc || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        conditions: { ...testData.conditions!, loyer_hc: Number(e.target.value) },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Charges (€)</Label>
                  <Input
                    type="number"
                    value={testData.conditions?.charges_montant || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        conditions: { ...testData.conditions!, charges_montant: Number(e.target.value) },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dépôt de garantie (€)</Label>
                  <Input
                    type="number"
                    value={testData.conditions?.depot_garantie || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        conditions: { ...testData.conditions!, depot_garantie: Number(e.target.value) },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input
                    type="date"
                    value={testData.conditions?.date_debut || ""}
                    onChange={(e) =>
                      setTestData({
                        ...testData,
                        conditions: { ...testData.conditions!, date_debut: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Classe DPE</Label>
                  <Select
                    value={testData.diagnostics?.dpe?.classe_energie || "C"}
                    onValueChange={(v) =>
                      setTestData({
                        ...testData,
                        diagnostics: {
                          ...testData.diagnostics!,
                          dpe: { ...testData.diagnostics!.dpe, classe_energie: v as "A" | "B" | "C" | "D" | "E" | "F" | "G" },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["A", "B", "C", "D", "E", "F", "G"].map((c) => (
                        <SelectItem key={c} value={c}>
                          Classe {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setTestFormOpen(false)}>
              Fermer
            </Button>
            <Button
              onClick={() => {
                setTestFormOpen(false);
                toast({
                  title: "Données sauvegardées",
                  description: "Les données de test ont été mises à jour",
                });
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Appliquer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

