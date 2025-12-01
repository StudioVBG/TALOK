"use client";
// @ts-nocheck

/**
 * Page: Fin de Bail + Rénovation
 * Dashboard des processus de fin de bail pour le propriétaire
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Plus,
  Filter,
  Search,
  Home,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  LeaseEndAlert,
  LeaseEndProcessCard,
  LeaseEndWizard,
} from "@/features/end-of-lease/components";
import { endOfLeaseService } from "@/features/end-of-lease/services/end-of-lease.service";
import type { LeaseEndProcess } from "@/lib/types/end-of-lease";

export default function EndOfLeasePage() {
  const [processes, setProcesses] = useState<LeaseEndProcess[]>([]);
  const [upcomingLeases, setUpcomingLeases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProcess, setSelectedProcess] = useState<LeaseEndProcess | null>(null);

  // Charger les données
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [processesData] = await Promise.all([
        endOfLeaseService.getProcesses(),
      ]);
      setProcesses(processesData);

      // Charger les baux à venir (via l'API trigger GET)
      const response = await fetch("/api/end-of-lease/trigger");
      if (response.ok) {
        const data = await response.json();
        setUpcomingLeases(data.upcoming_triggers || []);
      }
    } catch (error) {
      console.error("Erreur chargement données:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrer les processus
  const filteredProcesses = processes.filter((process) => {
    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesAddress = process.property?.adresse_complete?.toLowerCase().includes(query);
      const matchesCity = process.property?.ville?.toLowerCase().includes(query);
      if (!matchesAddress && !matchesCity) return false;
    }

    // Filtre par statut
    if (statusFilter !== "all" && process.status !== statusFilter) {
      return false;
    }

    // Filtre par onglet
    if (activeTab === "active") {
      return !["completed", "cancelled"].includes(process.status);
    } else if (activeTab === "completed") {
      return process.status === "completed";
    }

    return true;
  });

  // Statistiques
  const stats = {
    active: processes.filter((p) => !["completed", "cancelled"].includes(p.status)).length,
    urgent: processes.filter((p) => {
      const days = Math.ceil(
        (new Date(p.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return days <= 30 && !["completed", "cancelled"].includes(p.status);
    }).length,
    completed: processes.filter((p) => p.status === "completed").length,
    totalBudget: processes.reduce((sum, p) => sum + (p.total_budget || 0), 0),
  };

  // Créer un nouveau processus depuis un bail à venir
  const handleStartProcess = async (lease: any) => {
    try {
      const newProcess = await endOfLeaseService.createProcess({
        lease_id: lease.lease_id,
        property_id: lease.property.id,
        lease_end_date: lease.date_fin,
      });
      setProcesses([newProcess, ...processes]);
      setSelectedProcess(newProcess);
    } catch (error) {
      console.error("Erreur création processus:", error);
    }
  };

  return (
    <PageContainer
      title="Fin de Bail & Rénovation"
      description="Gérez vos fins de bail en moins de 10 minutes"
    >
      {/* Alertes pour les baux à venir */}
      {upcomingLeases.filter((l) => l.will_trigger_soon).length > 0 && (
        <div className="mb-6 space-y-3">
          {upcomingLeases
            .filter((l) => l.will_trigger_soon)
            .slice(0, 2)
            .map((lease) => (
              <LeaseEndAlert
                key={lease.lease_id}
                lease={{
                  id: lease.lease_id,
                  type_bail: lease.type_bail,
                  loyer: lease.loyer,
                  date_debut: "",
                  date_fin: lease.date_fin,
                }}
                property={{
                  id: lease.property.id,
                  adresse_complete: lease.property.adresse_complete,
                  ville: lease.property.ville,
                  type: lease.property.type,
                }}
                daysUntilEnd={Math.ceil(
                  (new Date(lease.date_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )}
                onStartProcess={() => handleStartProcess(lease)}
                onDismiss={() => {}}
              />
            ))}
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-xs text-muted-foreground">En cours</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.urgent}</div>
                <div className="text-xs text-muted-foreground">Urgents (J-30)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.completed}</div>
                <div className="text-xs text-muted-foreground">Terminés</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {stats.totalBudget.toLocaleString("fr-FR")} €
                </div>
                <div className="text-xs text-muted-foreground">Budget total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par adresse ou ville..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="triggered">Démarré</SelectItem>
            <SelectItem value="edl_in_progress">EDL en cours</SelectItem>
            <SelectItem value="renovation_in_progress">Travaux en cours</SelectItem>
            <SelectItem value="ready_to_rent">Prêt à louer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active" className="gap-2">
            <Clock className="w-4 h-4" />
            En cours ({stats.active})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Terminés ({stats.completed})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            <Calendar className="w-4 h-4" />
            À venir ({upcomingLeases.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredProcesses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Home className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">Aucun processus en cours</h3>
                <p className="text-muted-foreground mb-4">
                  Les fins de bail seront automatiquement détectées
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredProcesses.map((process, index) => (
                <motion.div
                  key={process.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <LeaseEndProcessCard
                    process={process}
                    onClick={() => setSelectedProcess(process)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {filteredProcesses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">Aucun processus terminé</h3>
                <p className="text-muted-foreground">
                  Vos fins de bail terminées apparaîtront ici
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredProcesses.map((process) => (
                <LeaseEndProcessCard
                  key={process.id}
                  process={process}
                  onClick={() => setSelectedProcess(process)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingLeases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">Aucune fin de bail à venir</h3>
                <p className="text-muted-foreground">
                  Les baux arrivant à échéance dans les 90 jours apparaîtront ici
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingLeases.map((lease, index) => (
                <motion.div
                  key={lease.lease_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-primary/10 rounded-xl">
                            <Home className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold">
                              {lease.property.adresse_complete}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {lease.property.ville} • {lease.type_bail}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <Badge
                              variant={lease.days_until_trigger <= 0 ? "destructive" : "secondary"}
                            >
                              {lease.days_until_trigger <= 0
                                ? "À déclencher"
                                : `J-${lease.days_until_trigger}`}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              Fin : {new Date(lease.date_fin).toLocaleDateString("fr-FR")}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleStartProcess(lease)}
                          >
                            Démarrer
                            <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Wizard modal */}
      {selectedProcess && (
        <LeaseEndWizard
          process={selectedProcess}
          onClose={() => setSelectedProcess(null)}
          onComplete={() => {
            setSelectedProcess(null);
            loadData();
          }}
        />
      )}
    </PageContainer>
  );
}

