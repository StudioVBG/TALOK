"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { Loader2, ArrowLeft, Calendar, Settings, History } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import {
  METER_CONFIG,
  MeterChart,
  MeterAlertBanner,
  MeterConnectButton,
  MeterReadingForm,
  ConsentBanner,
  ConsumptionComparison,
} from "@/components/meters";
import { cn } from "@/lib/utils";
import type {
  PropertyMeter,
  PropertyMeterReading,
  MeterAlert,
  ConsumptionChartData,
} from "@/lib/services/meters/types";

export default function OwnerMeterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;
  const meterId = params.meterId as string;

  const [meter, setMeter] = useState<PropertyMeter | null>(null);
  const [readings, setReadings] = useState<PropertyMeterReading[]>([]);
  const [chartData, setChartData] = useState<ConsumptionChartData[]>([]);
  const [alerts, setAlerts] = useState<MeterAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readingFormOpen, setReadingFormOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [readingsRes, chartRes, alertsRes] = await Promise.all([
        fetch(`/api/property-meters/${meterId}/readings?limit=50`),
        fetch(`/api/property-meters/${meterId}/readings/chart`),
        fetch(`/api/property-meters/alerts?property_id=${propertyId}&unacknowledged=true`),
      ]);

      if (readingsRes.ok) {
        const readingsData = await readingsRes.json();
        setReadings(readingsData.readings || []);
      }

      if (chartRes.ok) {
        const chartJson = await chartRes.json();
        setChartData(chartJson.chart_data || []);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts((alertsData.alerts || []).filter((a: MeterAlert) => a.meter_id === meterId));
      }

      // Fetch meter info from the list
      const metersRes = await fetch(`/api/property-meters?property_id=${propertyId}`);
      if (metersRes.ok) {
        const metersData = await metersRes.json();
        const found = (metersData.meters || []).find((m: PropertyMeter) => m.id === meterId);
        if (found) setMeter(found);
      }
    } catch {
      toast({ title: "Erreur chargement", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (meterId) fetchData();
  }, [meterId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!meter) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Compteur non trouve</h1>
        <Button onClick={() => router.back()}>Retour</Button>
      </div>
    );
  }

  const config = METER_CONFIG[meter.meter_type] || METER_CONFIG.other;
  const Icon = config.icon;

  const currentYear = new Date().getFullYear();
  const currentYearTotal = chartData
    .filter((d) => d.date.startsWith(String(currentYear)))
    .reduce((sum, d) => sum + d.value, 0);
  const previousYearTotal = chartData
    .filter((d) => d.date.startsWith(String(currentYear - 1)))
    .reduce((sum, d) => sum + d.value, 0);

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
              onClick={() => router.push(`/owner/properties/${propertyId}/meters`)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Tous les compteurs
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("p-2 rounded-lg shadow-lg", config.bgColor)}>
                <Icon className={cn("h-6 w-6", config.color)} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {config.label}
              </h1>
              {meter.is_connected && (
                <Badge className="bg-emerald-100 text-emerald-700">Connecte</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Ref: {meter.meter_reference}
              {meter.meter_serial && ` | Serie: ${meter.meter_serial}`}
            </p>
          </motion.div>

          <div className="flex gap-2">
            <MeterConnectButton
              meterId={meter.id}
              meterType={meter.meter_type}
              isConnected={meter.is_connected}
              onConnectionChange={fetchData}
            />
            <Button
              onClick={() => setReadingFormOpen(true)}
              className="bg-foreground hover:bg-foreground/90 text-background rounded-xl font-bold"
            >
              + Releve manuel
            </Button>
          </div>
        </div>

        {/* Consent banner for connected meters */}
        {meter.is_connected && meter.provider && (meter.provider === "enedis" || meter.provider === "grdf") && (
          <ConsentBanner provider={meter.provider} />
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <MeterAlertBanner
                key={alert.id}
                alert={alert}
                onAcknowledge={async (id) => {
                  await fetch(`/api/property-meters/alerts/${id}/acknowledge`, { method: "POST" });
                  setAlerts((prev) => prev.filter((a) => a.id !== id));
                }}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main content: chart + history */}
          <div className="lg:col-span-8 space-y-6">
            {/* Chart */}
            <MeterChart data={chartData} meterType={meter.meter_type} />

            {/* Readings history */}
            <GlassCard className="p-6">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <History className="h-4 w-4" /> Historique des releves
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {readings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucun releve enregistre
                  </p>
                ) : (
                  readings.map((reading, idx) => (
                    <div
                      key={reading.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted border border-border"
                    >
                      <div>
                        <p className="text-lg font-black text-foreground">
                          {Number(reading.value).toLocaleString("fr-FR")}{" "}
                          <span className="text-xs font-bold text-muted-foreground">
                            {reading.unit}
                          </span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(reading.reading_date).toLocaleDateString("fr-FR")}
                          </p>
                          <Badge variant="outline" className="text-[9px]">
                            {reading.source}
                          </Badge>
                        </div>
                      </div>
                      {idx < readings.length - 1 && (
                        <Badge className="bg-muted text-foreground border border-border font-bold text-xs">
                          +{(Number(reading.value) - Number(readings[idx + 1].value)).toLocaleString("fr-FR")}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Meter info */}
            <GlassCard className="p-6">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                <Settings className="h-3.5 w-3.5 inline mr-1" /> Informations
              </h3>
              <div className="space-y-3 text-sm">
                {meter.contract_holder && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Titulaire</span>
                    <span className="font-medium">{meter.contract_holder}</span>
                  </div>
                )}
                {meter.tariff_option && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Option tarifaire</span>
                    <span className="font-medium uppercase">{meter.tariff_option}</span>
                  </div>
                )}
                {meter.subscribed_power_kva && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Puissance</span>
                    <span className="font-medium">{meter.subscribed_power_kva} kVA</span>
                  </div>
                )}
                {meter.last_sync_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Derniere sync</span>
                    <span className="font-medium">
                      {new Date(meter.last_sync_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                )}
                {meter.sync_error_message && (
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs">
                    {meter.sync_error_message}
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Year comparison */}
            {(currentYearTotal > 0 || previousYearTotal > 0) && (
              <ConsumptionComparison
                currentYear={currentYear}
                currentTotal={currentYearTotal}
                previousTotal={previousYearTotal}
                meterType={meter.meter_type}
              />
            )}

            {/* Alert thresholds info */}
            {(meter.alert_threshold_daily || meter.alert_threshold_monthly) && (
              <GlassCard className="p-6">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Seuils d'alerte
                </h3>
                <div className="space-y-2 text-sm">
                  {meter.alert_threshold_daily && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Journalier</span>
                      <span className="font-bold text-amber-600">
                        {meter.alert_threshold_daily} {config.unitLabel}
                      </span>
                    </div>
                  )}
                  {meter.alert_threshold_monthly && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mensuel</span>
                      <span className="font-bold text-amber-600">
                        {meter.alert_threshold_monthly} {config.unitLabel}
                      </span>
                    </div>
                  )}
                </div>
              </GlassCard>
            )}
          </div>
        </div>

        <MeterReadingForm
          open={readingFormOpen}
          onOpenChange={setReadingFormOpen}
          meterId={meter.id}
          meterType={meter.meter_type}
          meterReference={meter.meter_reference}
          lastValue={readings[0] ? Number(readings[0].value) : null}
          onSuccess={fetchData}
          usePropertyMetersApi={true}
        />
      </div>
    </PageTransition>
  );
}
