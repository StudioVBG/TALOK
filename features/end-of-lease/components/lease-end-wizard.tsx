"use client";

/**
 * Wizard complet de fin de bail
 * Orchestre les 6 écrans du processus
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeaseEndChecklist } from "./lease-end-checklist";
import { EDLSortieInspection } from "./edl-sortie-inspection";
import { DamageAssessmentResults } from "./damage-assessment-results";
import { BudgetTimeline } from "./budget-timeline";
import { QuoteRequestForm } from "./quote-request-form";
import { ReadyToRentCard } from "./ready-to-rent-card";
import { endOfLeaseService } from "../services/end-of-lease.service";
import type {
  LeaseEndProcess,
  EDLInspectionItem,
  RenovationItem,
  LeaseEndTimelineItem,
  InspectionCategory,
} from "@/lib/types/end-of-lease";

type WizardStep = "checklist" | "edl" | "damages" | "budget" | "quotes" | "ready";

interface LeaseEndWizardProps {
  process: LeaseEndProcess;
  onClose: () => void;
  onComplete: () => void;
}

export function LeaseEndWizard({
  process: initialProcess,
  onClose,
  onComplete,
}: LeaseEndWizardProps) {
  const [process, setProcess] = useState(initialProcess);
  const [currentStep, setCurrentStep] = useState<WizardStep>("checklist");
  const [inspectionItems, setInspectionItems] = useState<any[]>([]);
  const [renovationItems, setRenovationItems] = useState<RenovationItem[]>([]);
  const [timeline, setTimeline] = useState<LeaseEndTimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Charger les données au démarrage
  useEffect(() => {
    loadProcessData();
  }, [process.id]);

  const loadProcessData = async () => {
    try {
      const [items, rItems, tItems] = await Promise.all([
        endOfLeaseService.getInspectionItems(process.id),
        endOfLeaseService.getRenovationItems(process.id),
        endOfLeaseService.getTimeline(process.id),
      ]);

      // Mapper les items d'inspection avec les catégories
      // ✅ FIX: Inclure estimated_cost depuis l'API au lieu de le hardcoder
      const mappedItems = items.map((item) => ({
        category: item.category,
        label: getCategoryLabel(item.category),
        icon: getCategoryIcon(item.category),
        description: getCategoryDescription(item.category),
        status: item.status,
        photos: item.photos || [],
        problemDescription: item.problem_description,
        estimatedCost: item.estimated_cost ?? 0,
        damageType: item.damage_type ?? "tenant_damage",
      }));

      setInspectionItems(mappedItems);
      setRenovationItems(rItems);
      setTimeline(tItems);

      // Déterminer l'étape actuelle basée sur le statut
      determineCurrentStep(process.status);
    } catch (error) {
      console.error("Erreur chargement données:", error);
    }
  };

  const determineCurrentStep = (status: string) => {
    const stepMap: Record<string, WizardStep> = {
      pending: "checklist",
      triggered: "checklist",
      edl_scheduled: "edl",
      edl_in_progress: "edl",
      edl_completed: "damages",
      damages_assessed: "damages",
      dg_calculated: "budget",
      renovation_planned: "quotes",
      renovation_in_progress: "quotes",
      ready_to_rent: "ready",
      completed: "ready",
    };
    setCurrentStep(stepMap[status] || "checklist");
  };

  // Handlers pour chaque étape
  const handleStepClick = (stepId: string) => {
    const stepMap: Record<string, WizardStep> = {
      edl: "edl",
      compare: "damages",
      budget: "budget",
      renovation: "quotes",
      ready: "ready",
    };
    if (stepMap[stepId]) {
      setCurrentStep(stepMap[stepId]);
    }
  };

  const handleInspectionUpdate = async (
    category: InspectionCategory,
    data: Partial<any>
  ) => {
    try {
      await endOfLeaseService.submitInspectionItem({
        lease_end_process_id: process.id,
        category,
        status: data.status,
        problem_description: data.problemDescription,
        photos: data.photos,
      });

      // Mettre à jour l'état local
      setInspectionItems((prev) =>
        prev.map((item) =>
          item.category === category ? { ...item, ...data } : item
        )
      );
    } catch (error) {
      console.error("Erreur mise à jour inspection:", error);
    }
  };

  const handleEdlComplete = async () => {
    try {
      setIsLoading(true);
      // Comparer les EDL
      await endOfLeaseService.compareEDL({
        lease_end_process_id: process.id,
        edl_entree_id: "", // L'API trouvera automatiquement
      });

      // Recharger les données
      await loadProcessData();
      setCurrentStep("damages");
    } catch (error) {
      console.error("Erreur comparaison EDL:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDamagesComplete = async () => {
    try {
      setIsLoading(true);
      // Calculer la retenue DG
      await endOfLeaseService.calculateDGRetention({
        lease_end_process_id: process.id,
      });

      // Estimer les coûts
      await endOfLeaseService.estimateRenovationCosts({
        lease_end_process_id: process.id,
      });

      // Générer la timeline
      await endOfLeaseService.generateTimeline({
        lease_end_process_id: process.id,
        start_date: new Date().toISOString(),
        renovation_items_count: renovationItems.length,
      });

      // Recharger et passer à l'étape suivante
      const updatedProcess = await endOfLeaseService.getProcessById(process.id);
      if (updatedProcess) setProcess(updatedProcess);
      await loadProcessData();
      setCurrentStep("budget");
    } catch (error) {
      console.error("Erreur calcul dommages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBudgetComplete = () => {
    setCurrentStep("quotes");
  };

  const handleQuotesSubmit = async (data: any) => {
    // Implémenter l'envoi des devis
    console.log("Envoi devis:", data);
  };

  const handleQuotesSkip = async () => {
    try {
      setIsLoading(true);
      await endOfLeaseService.markReadyToRent(process.id);
      const updatedProcess = await endOfLeaseService.getProcessById(process.id);
      if (updatedProcess) setProcess(updatedProcess);
      setCurrentStep("ready");
    } catch (error) {
      console.error("Erreur finalisation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimelineAction = async (actionId: string) => {
    try {
      await endOfLeaseService.completeTimelineAction(actionId);
      await loadProcessData();
    } catch (error) {
      console.error("Erreur action timeline:", error);
    }
  };

  // Calculer les données pour les composants
  // ✅ FIX: Utiliser les coûts estimés depuis l'API au lieu de hardcoder 150€
  const damages = inspectionItems
    .filter((item) => item.status === "problem")
    .map((item) => ({
      id: item.category,
      category: item.label,
      description: item.problemDescription || "Dégradation constatée",
      damageType: item.damageType ?? ("tenant_damage" as const),
      estimatedCost: item.estimatedCost ?? 0,
      tenantShare: item.estimatedCost ?? 0, // 100% pour dommage locataire
      ownerShare: item.damageType === "normal_wear" ? (item.estimatedCost ?? 0) : 0,
    }));

  const budgetSummary = {
    tenantResponsibility: process.tenant_damage_cost,
    ownerResponsibility: process.vetusty_cost + process.renovation_cost,
    totalBudget: process.total_budget,
    dgRetention: process.dg_retention_amount,
    dgRefund: process.dg_refund_amount,
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="container max-w-4xl mx-auto h-full py-4 px-4 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={currentStep === "checklist" ? onClose : () => setCurrentStep("checklist")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {currentStep === "checklist" ? "Fermer" : "Retour au sommaire"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Contenu dynamique */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === "checklist" && (
              <LeaseEndChecklist
                process={process}
                onStepClick={handleStepClick}
                onContinue={() => setCurrentStep("edl")}
              />
            )}

            {currentStep === "edl" && (
              <EDLSortieInspection
                processId={process.id}
                inspectionItems={inspectionItems}
                onItemUpdate={handleInspectionUpdate}
                onComplete={handleEdlComplete}
                onBack={() => setCurrentStep("checklist")}
              />
            )}

            {currentStep === "damages" && (
              <DamageAssessmentResults
                damages={damages}
                dgAmount={process.dg_amount}
                onContinue={handleDamagesComplete}
                onBack={() => setCurrentStep("edl")}
              />
            )}

            {currentStep === "budget" && (
              <BudgetTimeline
                timeline={timeline}
                budgetSummary={budgetSummary}
                estimatedReadyDate={process.ready_to_rent_date || new Date().toISOString()}
                onActionClick={handleTimelineAction}
                onComplete={handleBudgetComplete}
                onBack={() => setCurrentStep("damages")}
              />
            )}

            {currentStep === "quotes" && (
              <QuoteRequestForm
                renovationItems={renovationItems}
                onSubmit={handleQuotesSubmit}
                onBack={() => setCurrentStep("budget")}
                onSkip={handleQuotesSkip}
              />
            )}

            {currentStep === "ready" && process.property && (
              <ReadyToRentCard
                property={{
                  id: process.property.id,
                  adresse: process.property.adresse_complete,
                  ville: process.property.ville,
                  surface: process.property.surface || 0,
                  type: process.property.type,
                }}
                summary={{
                  totalDays: 7,
                  dgRetention: process.dg_retention_amount,
                  ownerInvestment: process.vetusty_cost + process.renovation_cost,
                  suggestedRent: (process.lease?.loyer || 0) + 50,
                  previousRent: process.lease?.loyer || 0,
                  rentIncrease: 50,
                }}
                completedDate={new Date().toISOString()}
                onCreateListing={() => console.log("Créer annonce")}
                onNewLease={() => console.log("Nouveau bail")}
                onViewProperty={onComplete}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Helpers
function getCategoryLabel(category: InspectionCategory): string {
  const labels: Record<string, string> = {
    murs: "Murs",
    sols: "Sols",
    salle_de_bain: "Salle de bain",
    cuisine: "Cuisine",
    fenetres_portes: "Fenêtres & Portes",
    electricite_plomberie: "Électricité & Plomberie",
    meubles: "Meubles",
  };
  return labels[category] || category;
}

function getCategoryIcon(category: InspectionCategory): string {
  const icons: Record<string, string> = {
    murs: "🧱",
    sols: "🪵",
    salle_de_bain: "🚿",
    cuisine: "🍳",
    fenetres_portes: "🚪",
    electricite_plomberie: "⚡",
    meubles: "🪑",
  };
  return icons[category] || "📦";
}

function getCategoryDescription(category: InspectionCategory): string {
  const descriptions: Record<string, string> = {
    murs: "Peinture, papier peint, trous",
    sols: "Parquet, carrelage, moquette",
    salle_de_bain: "Sanitaires, joints, robinetterie",
    cuisine: "Équipements, plan de travail",
    fenetres_portes: "Menuiseries, serrures, vitres",
    electricite_plomberie: "Prises, robinets, canalisations",
    meubles: "Mobilier (location meublée)",
  };
  return descriptions[category] || "";
}

