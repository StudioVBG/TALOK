"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Gauge, ArrowLeft, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import {
  MeterCard,
  MeterChart,
  MeterAlertBanner,
  MeterReadingForm,
} from "@/components/meters";
import type {
  MeterWithLastReading,
  MeterAlert,
  ConsumptionChartData,
} from "@/lib/services/meters/types";

export default function OwnerPropertyMetersPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;

  const [meters, setMeters] = useState<MeterWithLastReading[]>([]);
  const [alerts, setAlerts] = useState<MeterAlert[]>([]);
  const [chartData, setChartData] = useState<Record<string, ConsumptionChartData[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [readingDialogOpen, setReadingDialogOpen] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<MeterWithLastReading | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [metersRes, alertsRes] = await Promise.all([
        fetch(`/api/property-meters?property_id=${propertyId}`),
        fetch(`/api/property-meters/alerts?property_id=${propertyId}&unacknowledged=true`),
      ]);

      if (metersRes.ok) {
        const metersData = await metersRes.json();
        setMeters(metersData.meters || []);

        // Fetch chart data for each meter
        const charts: Record<string, ConsumptionChartData[]> = {};
        for (const meter of metersData.meters || []) {
          try {
            const chartRes = await fetch(`/api/property-meters/${meter.id}/readings/chart`);
            if (chartRes.ok) {
              const chartJson = await chartRes.json();
              charts[meter.id] = chartJson.chart_data || [];
            }
          } catch {
            // Non-blocking
          }
        }
        setChartData(charts);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les compteurs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) fetchData();
  }, [propertyId]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/property-meters/alerts/${alertId}/acknowledge`, {
        method: "POST",
      });
      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
        toast({ title: "Alerte acquittee" });
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2"
              onClick={() => router.push(`/owner/properties/${propertyId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour au bien
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500 rounded-lg shadow-lg shadow-amber-200">
                <Gauge className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Compteurs connectes
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Suivi automatique de la consommation energetique
            </p>
          </motion.div>

          <Button
            onClick={() => router.push(`/owner/properties/${propertyId}/meters/add`)}
            className="bg-foreground hover:bg-foreground/90 text-background rounded-xl font-bold shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" /> Ajouter un compteur
          </Button>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <MeterAlertBanner
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledgeAlert}
              />
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          </div>
        ) : meters.length === 0 ? (
          <GlassCard className="p-12 text-center border-border">
            <div className="h-20 w-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Gauge className="h-10 w-10 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Aucun compteur configure</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Ajoutez les compteurs de votre bien pour suivre la consommation automatiquement
              via Enedis (electricite) ou GRDF (gaz).
            </p>
            <Button
              onClick={() => router.push(`/owner/properties/${propertyId}/meters/add`)}
              className="mt-6 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold"
            >
              <Plus className="h-4 w-4 mr-2" /> Ajouter mon premier compteur
            </Button>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Meters grid */}
            <div className="lg:col-span-8">
              <div className="grid gap-6 md:grid-cols-2">
                {meters.map((meter, index) => (
                  <motion.div
                    key={meter.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <MeterCard
                      meter={meter}
                      onViewDetail={(id) =>
                        router.push(`/owner/properties/${propertyId}/meters/${id}`)
                      }
                      onAddReading={(id) => {
                        const m = meters.find((m) => m.id === id);
                        if (m) {
                          setSelectedMeter(m);
                          setReadingDialogOpen(true);
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Sidebar: charts */}
            <div className="lg:col-span-4 space-y-6">
              {meters.map((meter) => (
                <MeterChart
                  key={`chart-${meter.id}`}
                  data={chartData[meter.id] || []}
                  meterType={meter.meter_type}
                />
              ))}
            </div>
          </div>
        )}

        {/* Reading form dialog */}
        {selectedMeter && (
          <MeterReadingForm
            open={readingDialogOpen}
            onOpenChange={setReadingDialogOpen}
            meterId={selectedMeter.id}
            meterType={selectedMeter.meter_type}
            meterReference={selectedMeter.meter_reference}
            lastValue={selectedMeter.last_reading?.value}
            onSuccess={fetchData}
            usePropertyMetersApi={true}
          />
        )}
      </div>
    </PageTransition>
  );
}
