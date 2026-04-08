"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  ArrowLeft,
  Loader2,
  GitCompare,
  FileText,
  Calculator,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ComparisonSplitView } from "@/features/edl/components/ComparisonSplitView";
import { RetenueSummary } from "@/features/edl/components/RetenueSummary";
import { VetusteCalculator } from "@/features/edl/components/VetusteCalculator";

interface ComparisonData {
  edl_sortie_id: string;
  edl_entree_id: string;
  comparison: Array<{
    room_name: string;
    elements: Array<{
      item_name: string;
      element_type: string | null;
      entree: Record<string, unknown> | null;
      sortie: Record<string, unknown> | null;
      degradation_noted: boolean;
      condition_changed: boolean;
    }>;
    has_degradations: boolean;
  }>;
  summary: {
    total_rooms: number;
    rooms_with_degradations: number;
    total_retenue_cents: number;
    depot_garantie_cents: number | null;
    montant_restitue_cents: number | null;
  };
}

interface RetenueData {
  duree_occupation_ans: number;
  retenues: Array<{
    item_id: string;
    room_name: string;
    item_name: string;
    element_type: string | null;
    entry_condition: string | null;
    exit_condition: string | null;
    cout_reparation_cents: number;
    vetuste_applicable: boolean;
    vetuste_coefficient: number;
    retenue_cents: number;
  }>;
  summary: {
    total_retenue_cents: number;
    depot_garantie_cents: number;
    montant_restitue_cents: number;
    nb_degradations: number;
  };
}

interface VetusteEntry {
  element_type: string;
  duree_vie_ans: number;
  taux_abattement_annuel: number;
  valeur_residuelle_min: number;
  notes: string | null;
}

type Tab = "comparison" | "retenues" | "vetuste";

export default function CompareEdlPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const edlId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>("comparison");
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [retenueData, setRetenueData] = useState<RetenueData | null>(null);
  const [vetusteGrid, setVetusteGrid] = useState<VetusteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [compRes, retRes, gridRes] = await Promise.all([
          fetch(`/api/edl/${edlId}/compare`),
          fetch(`/api/edl/${edlId}/retenues`),
          fetch(`/api/vetuste/grid`),
        ]);

        if (!compRes.ok) {
          const err = await compRes.json();
          throw new Error(err.error || "Erreur de comparaison");
        }

        const compData = await compRes.json();
        setComparison(compData);

        if (retRes.ok) {
          const retData = await retRes.json();
          setRetenueData(retData);
        }

        if (gridRes.ok) {
          const gridData = await gridRes.json();
          setVetusteGrid(gridData.grid || []);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Erreur de chargement";
        setError(message);
        toast({
          title: "Erreur",
          description: message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    if (edlId) fetchData();
  }, [edlId, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-red-200">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-red-700">
              {error || "Données de comparaison indisponibles"}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              Assurez-vous qu&apos;un EDL d&apos;entrée signé existe pour ce bail.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Transform comparison data for the split view component
  const rooms = comparison.comparison.map((room) => ({
    room_name: room.room_name,
    has_degradations: room.has_degradations,
    elements: room.elements.map((el) => ({
      item_name: el.item_name,
      element_type: el.element_type,
      entree: el.entree
        ? {
            condition: (el.entree.condition as string) || null,
            notes: (el.entree.notes as string) || null,
            photos: ((el.entree.photos as Array<{ url: string }>) || []),
          }
        : null,
      sortie: el.sortie
        ? {
            condition: (el.sortie.condition as string) || null,
            notes: (el.sortie.notes as string) || null,
            photos: ((el.sortie.photos as Array<{ url: string }>) || []),
            degradation_noted: el.degradation_noted,
            retenue_cents: (el.sortie.retenue_cents as number) || 0,
            vetuste_coefficient:
              (el.sortie.vetuste_coefficient as number) || null,
          }
        : null,
      condition_changed: el.condition_changed,
      degradation_noted: el.degradation_noted,
    })),
  }));

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "comparison",
      label: "Comparaison",
      icon: <GitCompare className="h-4 w-4" />,
    },
    {
      key: "retenues",
      label: "Retenues",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      key: "vetuste",
      label: "Grille vétusté",
      icon: <Calculator className="h-4 w-4" />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-muted min-h-screen pb-20"
    >
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Breadcrumb
          items={[
            { label: "États des lieux", href: "/owner/inspections" },
            {
              label: "Détail",
              href: `/owner/inspections/${edlId}`,
            },
            { label: "Comparaison" },
          ]}
          homeHref="/owner/dashboard"
        />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <Link
              href={`/owner/inspections/${edlId}`}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Retour au détail
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitCompare className="h-6 w-6 text-indigo-600" />
              Comparaison entrée / sortie
            </h1>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {comparison.summary.total_rooms} pièces
            </Badge>
            {comparison.summary.rooms_with_degradations > 0 && (
              <Badge variant="destructive" className="text-xs">
                {comparison.summary.rooms_with_degradations} avec dégradations
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "comparison" && (
          <ComparisonSplitView rooms={rooms} showRetenues />
        )}

        {activeTab === "retenues" && retenueData && (
          <RetenueSummary
            retenues={retenueData.retenues}
            summary={{
              ...retenueData.summary,
              duree_occupation_ans: retenueData.duree_occupation_ans,
            }}
          />
        )}

        {activeTab === "retenues" && !retenueData && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Aucune retenue calculée. Renseignez les dégradations et coûts de
              réparation depuis la page d&apos;édition.
            </CardContent>
          </Card>
        )}

        {activeTab === "vetuste" && (
          <VetusteCalculator
            grid={vetusteGrid}
            dureeOccupationAns={retenueData?.duree_occupation_ans || 0}
          />
        )}
      </div>
    </motion.div>
  );
}
