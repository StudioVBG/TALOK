/**
 * ProcessTestsContent - Contenu de la page Process & QA
 * Affiche les scénarios de test et permet de les exécuter
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Play, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { containerVariants, itemVariants } from "@/lib/design-system/animations";
import { TestScenario, TestResult, runTestScenario } from "@/features/admin/services/process-tests.service";

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: "create_fast_T2_habitation",
    name: "Création rapide T2 habitation",
    description: "Créer un bien en mode rapide (appartement T2)",
    steps: [
      "Créer un brouillon avec type_bien='appartement', wizard_mode='fast'",
      "Remplir les champs minimaux (adresse, surface, nb_pieces=2, nb_chambres=1)",
      "Ajouter au moins 1 photo",
      "Soumettre pour validation",
    ],
  },
  {
    id: "create_detailed_T3_habitation",
    name: "Création détaillée T3 habitation",
    description: "Créer un bien en mode avancé (maison T3) avec toutes les étapes",
    steps: [
      "Créer un brouillon avec type_bien='maison', wizard_mode='detailed'",
      "Remplir toutes les étapes (adresse, structure, accès, extérieurs, confort, équipements)",
      "Créer au moins 1 pièce de type 'sejour'",
      "Ajouter au moins 3 photos",
      "Soumettre pour validation",
    ],
  },
  {
    id: "create_parking",
    name: "Création parking/box",
    description: "Créer un parking ou box avec les champs spécifiques",
    steps: [
      "Créer un brouillon avec type_bien='parking' ou 'box'",
      "Remplir les champs parking (parking_type, parking_gabarit, adresse)",
      "Ajouter au moins 1 photo",
      "Soumettre pour validation",
    ],
  },
  {
    id: "submit_without_photos",
    name: "Soumission sans photos (doit échouer)",
    description: "Tenter de soumettre un bien sans photos (validation doit échouer)",
    steps: [
      "Créer un brouillon avec type_bien='appartement'",
      "Remplir les champs minimaux",
      "Ne pas ajouter de photos",
      "Tenter de soumettre (doit retourner une erreur de validation)",
    ],
    shouldFail: true,
  },
  {
    id: "switch_mode_location_with_active_lease",
    name: "Changement mode_location avec bail actif (doit échouer)",
    description: "Tenter de changer le mode de location alors qu'un bail est actif",
    steps: [
      "Créer un bien avec mode_location='longue_duree'",
      "Créer un bail actif sur ce bien",
      "Tenter de changer mode_location vers 'courte_duree'",
      "Vérifier que l'erreur active_lease_blocking est retournée",
    ],
    shouldFail: true,
  },
];

export function ProcessTestsContent() {
  const { toast } = useToast();
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());

  const handleRunTest = async (scenario: TestScenario) => {
    setRunningTests((prev) => new Set(prev).add(scenario.id));

    try {
      const result = await runTestScenario(scenario);
      setResults((prev) => ({
        ...prev,
        [scenario.id]: result,
      }));

      if (result.success) {
        toast({
          title: "Test réussi",
          description: `${scenario.name} a été exécuté avec succès.`,
        });
      } else {
        toast({
          title: "Test échoué",
          description: result.error || `${scenario.name} a échoué.`,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      setResults((prev) => ({
        ...prev,
        [scenario.id]: {
          success: false,
          error: error instanceof Error ? error.message : "Erreur inconnue",
          logs: [],
        },
      }));
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de l'exécution du test.",
        variant: "destructive",
      });
    } finally {
      setRunningTests((prev) => {
        const next = new Set(prev);
        next.delete(scenario.id);
        return next;
      });
    }
  };

  const handleRunAll = async () => {
    for (const scenario of TEST_SCENARIOS) {
      await handleRunTest(scenario);
      // Petit délai entre les tests pour éviter la surcharge
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Process & QA</h1>
          <p className="text-muted-foreground">
            Tests automatisés pour vérifier que les processus critiques fonctionnent correctement
          </p>
        </motion.div>

        {/* Actions globales */}
        <motion.div variants={itemVariants} className="flex gap-4">
          <Button onClick={handleRunAll} disabled={runningTests.size > 0}>
            <Play className="h-4 w-4 mr-2" />
            Exécuter tous les tests
          </Button>
        </motion.div>

        {/* Liste des scénarios */}
        <div className="grid gap-6">
          {TEST_SCENARIOS.map((scenario) => {
            const result = results[scenario.id];
            const isRunning = runningTests.has(scenario.id);
            const isSuccess = result?.success === true;
            const isFailure = result?.success === false;

            return (
              <motion.div key={scenario.id} variants={itemVariants}>
                <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle>{scenario.name}</CardTitle>
                          {isSuccess && (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Réussi
                            </Badge>
                          )}
                          {isFailure && (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Échoué
                            </Badge>
                          )}
                          {isRunning && (
                            <Badge variant="secondary">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              En cours...
                            </Badge>
                          )}
                          {scenario.shouldFail && (
                            <Badge variant="outline">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Doit échouer
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{scenario.description}</CardDescription>
                      </div>
                      <Button
                        onClick={() => handleRunTest(scenario)}
                        disabled={isRunning}
                        variant={isSuccess ? "outline" : "default"}
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Exécution...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Exécuter
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Étapes */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Étapes du test
                      </h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        {scenario.steps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {/* Résultats */}
                    {result && (
                      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                        <h4 className="text-sm font-semibold">Résultat</h4>
                        {result.success ? (
                          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Test réussi</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            <span>{result.error || "Test échoué"}</span>
                          </div>
                        )}
                        {result.logs && result.logs.length > 0 && (
                          <div className="mt-2">
                            <h5 className="text-xs font-semibold mb-1">Logs :</h5>
                            <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-40">
                              {result.logs.join("\n")}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

