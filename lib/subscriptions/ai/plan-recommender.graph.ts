/**
 * LangGraph - Plan Recommender
 * SOTA Décembre 2025 - Optimisé pour GPT-5.1
 * 
 * Recommande le plan optimal basé sur le profil et l'usage utilisateur
 * Utilise la configuration centralisée des modèles IA
 */

import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createFastModel } from "@/lib/ai/config";
import { PLANS, type PlanSlug, formatPrice } from "../plans";

// ============================================
// STATE DEFINITION
// ============================================

const PlanRecommenderState = Annotation.Root({
  // Input
  userId: Annotation<string>,
  currentPlan: Annotation<PlanSlug>,
  
  // User profile
  propertiesCount: Annotation<number>,
  projectedProperties: Annotation<number>,
  leasesCount: Annotation<number>,
  monthlyRevenue: Annotation<number>,
  signaturesPerMonth: Annotation<number>,
  needsMultiUsers: Annotation<boolean>,
  needsAdvancedFeatures: Annotation<boolean>,
  isProfessional: Annotation<boolean>,
  
  // Current usage (percentages)
  propertiesUsagePercent: Annotation<number>,
  signaturesUsagePercent: Annotation<number>,
  
  // Analysis
  usageScore: Annotation<number>,
  growthPotential: Annotation<"low" | "medium" | "high">,
  featureNeeds: Annotation<string[]>,
  
  // Output
  recommendedPlan: Annotation<PlanSlug>,
  reasoning: Annotation<string>,
  highlights: Annotation<string[]>,
  estimatedSavings: Annotation<number | null>,
  confidence: Annotation<number>,
});

type PlanRecommenderStateType = typeof PlanRecommenderState.State;

// ============================================
// NODES
// ============================================

/**
 * Analyse l'usage actuel et calcule le score
 */
async function analyzeUsage(state: PlanRecommenderStateType): Promise<Partial<PlanRecommenderStateType>> {
  const currentPlanConfig = PLANS[state.currentPlan];
  const limits = currentPlanConfig.limits;
  
  // Calculer le score d'usage (0-100)
  let usageScore = 0;
  const factors: { weight: number; value: number }[] = [];
  
  // Properties usage
  if (limits.max_properties !== -1) {
    const propUsage = (state.propertiesCount / limits.max_properties) * 100;
    factors.push({ weight: 0.4, value: propUsage });
  }
  
  // Signatures usage
  if (limits.signatures_monthly_quota !== -1 && limits.signatures_monthly_quota > 0) {
    const sigUsage = state.signaturesUsagePercent;
    factors.push({ weight: 0.2, value: sigUsage });
  }
  
  // Growth factor
  const growthFactor = state.projectedProperties > state.propertiesCount 
    ? ((state.projectedProperties - state.propertiesCount) / Math.max(1, state.propertiesCount)) * 50
    : 0;
  factors.push({ weight: 0.2, value: Math.min(100, growthFactor) });
  
  // Professional factor
  if (state.isProfessional) {
    factors.push({ weight: 0.2, value: 80 });
  } else {
    factors.push({ weight: 0.2, value: 30 });
  }
  
  // Calculate weighted average
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  usageScore = factors.reduce((sum, f) => sum + f.weight * f.value, 0) / totalWeight;
  
  // Determine growth potential
  let growthPotential: "low" | "medium" | "high" = "low";
  if (state.projectedProperties > state.propertiesCount * 1.5) {
    growthPotential = "high";
  } else if (state.projectedProperties > state.propertiesCount * 1.2) {
    growthPotential = "medium";
  }
  
  // Identify feature needs
  const featureNeeds: string[] = [];
  
  if (state.signaturesPerMonth > 0 && !currentPlanConfig.features.electronic_signature) {
    featureNeeds.push("Signature électronique");
  }
  if (state.needsMultiUsers && !currentPlanConfig.features.multi_users) {
    featureNeeds.push("Multi-utilisateurs");
  }
  if (state.needsAdvancedFeatures) {
    if (!currentPlanConfig.features.ai_scoring) featureNeeds.push("Scoring IA");
    if (!currentPlanConfig.features.open_banking) featureNeeds.push("Open Banking");
    if (!currentPlanConfig.features.edl_digital) featureNeeds.push("EDL numérique");
  }
  if (state.monthlyRevenue > 5000 && !currentPlanConfig.features.reports_advanced) {
    featureNeeds.push("Rapports avancés");
  }
  if (state.isProfessional && !currentPlanConfig.features.provider_management) {
    featureNeeds.push("Gestion prestataires");
  }
  
  return {
    usageScore: Math.round(usageScore),
    growthPotential,
    featureNeeds,
  };
}

/**
 * Détermine le plan recommandé basé sur l'analyse
 */
async function determineRecommendation(state: PlanRecommenderStateType): Promise<Partial<PlanRecommenderStateType>> {
  const { usageScore, growthPotential, featureNeeds, currentPlan, propertiesCount, projectedProperties, isProfessional } = state;
  
  // Règles de recommandation
  let recommendedPlan: PlanSlug = currentPlan;
  let reasoning = "";
  let confidence = 50;
  
  // Cas 1: Plan actuel insuffisant (usage > 80%)
  if (usageScore >= 80) {
    if (currentPlan === "starter") {
      recommendedPlan = featureNeeds.length > 2 || isProfessional ? "pro" : "confort";
      reasoning = "Votre limite de biens est atteinte. Passez à un plan supérieur pour continuer à croître.";
      confidence = 90;
    } else if (currentPlan === "confort") {
      recommendedPlan = "pro";
      reasoning = "Vous approchez des limites du plan Confort. Le plan Pro vous offre plus de capacité et des fonctionnalités avancées.";
      confidence = 85;
    } else if (currentPlan === "pro" && projectedProperties > 100) {
      recommendedPlan = "enterprise";
      reasoning = "Votre parc immobilier dépasse bientôt les 100 biens. L'offre Enterprise vous garantit une scalabilité sans limite.";
      confidence = 75;
    }
  }
  
  // Cas 2: Besoins de features avancées
  else if (featureNeeds.length >= 3) {
    if (currentPlan === "starter") {
      recommendedPlan = "confort";
      reasoning = `Vous avez besoin de fonctionnalités avancées (${featureNeeds.slice(0, 2).join(", ")}). Le plan Confort répond parfaitement à ces besoins.`;
      confidence = 80;
    } else if (currentPlan === "confort" && featureNeeds.some(f => ["Multi-utilisateurs", "API", "Rapports avancés"].includes(f))) {
      recommendedPlan = "pro";
      reasoning = "Vos besoins en fonctionnalités professionnelles correspondent au plan Pro.";
      confidence = 75;
    }
  }
  
  // Cas 3: Professionnel avec petit parc
  else if (isProfessional && currentPlan === "starter") {
    recommendedPlan = "confort";
    reasoning = "En tant que professionnel, le plan Confort vous offre les outils essentiels pour gérer efficacement vos biens.";
    confidence = 70;
  }
  
  // Cas 4: Croissance anticipée forte
  else if (growthPotential === "high" && currentPlan !== "enterprise") {
    const nextPlan: Partial<Record<PlanSlug, PlanSlug>> = {
      gratuit: "starter",
      starter: "confort",
      confort: "pro",
      pro: "enterprise",
      enterprise: "enterprise",
      enterprise_s: "enterprise_m",
      enterprise_m: "enterprise_l",
      enterprise_l: "enterprise_xl",
      enterprise_xl: "enterprise_xl",
    };
    recommendedPlan = nextPlan[currentPlan] ?? currentPlan;
    reasoning = "Votre croissance anticipée suggère de passer au plan supérieur pour éviter d'être limité.";
    confidence = 65;
  }
  
  // Cas 5: Plan actuel optimal
  else {
    recommendedPlan = currentPlan;
    reasoning = "Votre plan actuel correspond bien à votre usage. Vous pouvez envisager un upgrade si vous avez besoin de plus de fonctionnalités.";
    confidence = 60;
  }
  
  return {
    recommendedPlan,
    reasoning,
    confidence,
  };
}

/**
 * Génère les highlights et calcule les économies potentielles
 */
async function generateHighlights(state: PlanRecommenderStateType): Promise<Partial<PlanRecommenderStateType>> {
  const { recommendedPlan, currentPlan, featureNeeds, propertiesCount, monthlyRevenue } = state;
  
  const highlights: string[] = [];
  let estimatedSavings: number | null = null;
  
  const recPlan = PLANS[recommendedPlan];
  const curPlan = PLANS[currentPlan];
  
  // Si upgrade recommandé
  if (recommendedPlan !== currentPlan) {
    // Highlights basés sur les features gagnées
    const gainedFeatures = Object.entries(recPlan.features)
      .filter(([key, value]) => value && !curPlan.features[key as keyof typeof curPlan.features])
      .map(([key]) => key);
    
    if (gainedFeatures.includes("electronic_signature")) {
      highlights.push("✍️ Signez vos baux en ligne et gagnez du temps");
    }
    if (gainedFeatures.includes("ai_scoring")) {
      highlights.push("🤖 Évaluez la solvabilité de vos locataires avec l'IA");
    }
    if (gainedFeatures.includes("auto_reminders_email")) {
      highlights.push("📧 Automatisez vos relances de loyer");
    }
    if (gainedFeatures.includes("edl_digital")) {
      highlights.push("📋 Créez des états des lieux numériques professionnels");
    }
    if (gainedFeatures.includes("open_banking")) {
      highlights.push("🏦 Connectez vos comptes bancaires pour un suivi automatique");
    }
    if (gainedFeatures.includes("multi_users")) {
      highlights.push("👥 Collaborez avec votre équipe sur la même plateforme");
    }
    
    // Highlight de limite
    if (recPlan.limits.max_properties > curPlan.limits.max_properties || recPlan.limits.max_properties === -1) {
      highlights.push(`🏠 Gérez jusqu'à ${recPlan.limits.max_properties === -1 ? "un nombre illimité de" : recPlan.limits.max_properties} biens`);
    }
    
    // Calcul des économies potentielles (comparé à une gestion manuelle ou autre outil)
    // Estimation: 2h/bien/mois économisées à 30€/h
    const hoursPerProperty = 2;
    const hourlyRate = 30;
    const monthlySavings = propertiesCount * hoursPerProperty * hourlyRate;
    const planCost = (recPlan.price_monthly || 0) / 100;
    
    if (monthlySavings > planCost * 1.5) {
      estimatedSavings = Math.round(monthlySavings - planCost);
      highlights.push(`💰 Économisez ~${estimatedSavings}€/mois en temps de gestion`);
    }
  } else {
    // Plan actuel optimal
    highlights.push("✅ Votre plan actuel est adapté à vos besoins");
    
    if (featureNeeds.length > 0) {
      highlights.push(`💡 Fonctionnalités à explorer: ${featureNeeds.slice(0, 2).join(", ")}`);
    }
  }
  
  return {
    highlights: highlights.slice(0, 5), // Max 5 highlights
    estimatedSavings,
  };
}

/**
 * Optionnel: Utilise GPT pour améliorer le reasoning
 */
async function enhanceWithAI(state: PlanRecommenderStateType): Promise<Partial<PlanRecommenderStateType>> {
  // Skip si pas de clé API ou si confidence déjà haute
  if (!process.env.OPENAI_API_KEY || state.confidence >= 85) {
    return {};
  }
  
  try {
    // Utiliser le modèle rapide pour cette tâche simple de reformulation
    // Note: Avec GPT-5.1, utiliser reasoning_effort: "low" pour ce type de tâche
    const model = createFastModel();
    
    const systemPrompt = `Tu es un conseiller expert en gestion locative. 
Tu dois reformuler une recommandation de plan d'abonnement de manière personnalisée et engageante.
Sois concis (2-3 phrases max), professionnel et utilise le tutoiement.`;

    const userPrompt = `Contexte utilisateur:
- Biens actuels: ${state.propertiesCount}
- Biens projetés: ${state.projectedProperties}
- Revenus mensuels: ${state.monthlyRevenue}€
- Plan actuel: ${state.currentPlan}
- Professionnel: ${state.isProfessional ? "Oui" : "Non"}

Recommandation: ${PLANS[state.recommendedPlan].name} (${formatPrice(PLANS[state.recommendedPlan].price_monthly)}/mois)
Raison initiale: ${state.reasoning}

Reformule cette recommandation de manière engageante et personnalisée:`;

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);
    
    return {
      reasoning: response.content as string,
    };
  } catch (error) {
    console.error("[PlanRecommender] AI enhancement failed:", error);
    return {};
  }
}

// ============================================
// GRAPH DEFINITION
// ============================================

const workflow = new StateGraph(PlanRecommenderState)
  .addNode("analyzeUsage", analyzeUsage)
  .addNode("determineRecommendation", determineRecommendation)
  .addNode("generateHighlights", generateHighlights)
  .addNode("enhanceWithAI", enhanceWithAI)
  .addEdge(START, "analyzeUsage")
  .addEdge("analyzeUsage", "determineRecommendation")
  .addEdge("determineRecommendation", "generateHighlights")
  .addEdge("generateHighlights", "enhanceWithAI")
  .addEdge("enhanceWithAI", END);

export const planRecommenderGraph = workflow.compile();

// ============================================
// HELPER FUNCTION
// ============================================

export interface PlanRecommendation {
  recommendedPlan: PlanSlug;
  reasoning: string;
  highlights: string[];
  estimatedSavings: number | null;
  confidence: number;
  currentPlan: PlanSlug;
  isUpgrade: boolean;
}

export async function getRecommendedPlan(input: {
  userId: string;
  currentPlan: PlanSlug;
  propertiesCount: number;
  projectedProperties: number;
  leasesCount: number;
  monthlyRevenue: number;
  signaturesPerMonth: number;
  needsMultiUsers: boolean;
  needsAdvancedFeatures: boolean;
  isProfessional: boolean;
  propertiesUsagePercent: number;
  signaturesUsagePercent: number;
}): Promise<PlanRecommendation> {
  const result = await planRecommenderGraph.invoke({
    ...input,
    usageScore: 0,
    growthPotential: "low",
    featureNeeds: [],
    recommendedPlan: input.currentPlan,
    reasoning: "",
    highlights: [],
    estimatedSavings: null,
    confidence: 0,
  });

  const currentLevel = ["starter", "confort", "pro", "enterprise"].indexOf(input.currentPlan);
  const recommendedLevel = ["starter", "confort", "pro", "enterprise"].indexOf(result.recommendedPlan);

  return {
    recommendedPlan: result.recommendedPlan,
    reasoning: result.reasoning,
    highlights: result.highlights,
    estimatedSavings: result.estimatedSavings,
    confidence: result.confidence,
    currentPlan: input.currentPlan,
    isUpgrade: recommendedLevel > currentLevel,
  };
}

export default planRecommenderGraph;

