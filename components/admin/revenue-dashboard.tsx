'use client';

/**
 * Revenue Intelligence Dashboard
 * SOTA 2026 - Real-time revenue analytics
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RevenueMetrics {
  mrr: number;
  arr: number;
  nrr: number;
  grr: number;
  arpu: number;
  arppu: number;
  ltv: number;
  churn_rate: number;
  revenue_churn_rate: number;
  mrr_new: number;
  mrr_expansion: number;
  mrr_contraction: number;
  mrr_churn: number;
  mrr_reactivation: number;
  quick_ratio: number;
  growth_rate: number;
}

interface ChurnPrediction {
  user_id: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: Array<{ factor: string; weight: number; description: string }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function TrendIndicator({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0;
  const isNeutral = value === 0;

  if (isNeutral) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }

  return isPositive ? (
    <ArrowUpRight className="h-4 w-4 text-green-500" />
  ) : (
    <ArrowDownRight className="h-4 w-4 text-red-500" />
  );
}

function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  inverse = false,
}: {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  inverse?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className="flex items-center text-xs text-muted-foreground">
            <TrendIndicator value={change} inverse={inverse} />
            <span className={change > 0 && !inverse ? 'text-green-500' : change < 0 && !inverse ? 'text-red-500' : ''}>
              {formatPercent(change)}
            </span>
            {changeLabel && <span className="ml-1">{changeLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MRRWaterfallChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => Math.max(d.starting_mrr, d.ending_mrr)));

  return (
    <div className="space-y-4">
      {data.map((month, index) => (
        <div key={month.month} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{month.month}</span>
            <span className="text-muted-foreground">
              {formatCurrency(month.ending_mrr)}
            </span>
          </div>
          <div className="flex gap-1 h-6">
            <div
              className="bg-blue-500 rounded"
              style={{ width: `${(month.starting_mrr / maxValue) * 40}%` }}
              title={`Départ: ${formatCurrency(month.starting_mrr)}`}
            />
            {month.new_mrr > 0 && (
              <div
                className="bg-green-500 rounded"
                style={{ width: `${(month.new_mrr / maxValue) * 40}%` }}
                title={`Nouveau: ${formatCurrency(month.new_mrr)}`}
              />
            )}
            {month.expansion_mrr > 0 && (
              <div
                className="bg-emerald-400 rounded"
                style={{ width: `${(month.expansion_mrr / maxValue) * 40}%` }}
                title={`Expansion: ${formatCurrency(month.expansion_mrr)}`}
              />
            )}
            {month.churned_mrr > 0 && (
              <div
                className="bg-red-500 rounded"
                style={{ width: `${(month.churned_mrr / maxValue) * 40}%` }}
                title={`Churn: ${formatCurrency(month.churned_mrr)}`}
              />
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="text-green-500">+{formatCurrency(month.new_mrr + month.expansion_mrr)}</span>
            <span className="text-red-500">-{formatCurrency(month.churned_mrr + month.contraction_mrr)}</span>
            <span className={month.net_change >= 0 ? 'text-green-500' : 'text-red-500'}>
              Net: {formatCurrency(month.net_change)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChurnRiskList({ predictions }: { predictions: ChurnPrediction[] }) {
  const riskColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-3">
      {predictions.map((prediction) => (
        <div
          key={prediction.user_id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-sm">User {prediction.user_id.slice(0, 8)}...</div>
              <div className="text-xs text-muted-foreground">
                {prediction.factors[0]?.description || 'Risque détecté'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={prediction.risk_score} className="w-20" />
            <Badge className={riskColors[prediction.risk_level]}>
              {prediction.risk_score}%
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RevenueDashboard() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [waterfall, setWaterfall] = useState<any[]>([]);
  const [churnRisks, setChurnRisks] = useState<ChurnPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  async function fetchData() {
    setLoading(true);
    try {
      const [metricsRes, waterfallRes, churnRes] = await Promise.all([
        fetch('/api/sota/revenue?type=metrics'),
        fetch('/api/sota/revenue?type=waterfall'),
        fetch('/api/sota/churn?type=high-risk&limit=5'),
      ]);

      if (metricsRes.ok) {
        setMetrics(await metricsRes.json());
      }
      if (waterfallRes.ok) {
        setWaterfall(await waterfallRes.json());
      }
      if (churnRes.ok) {
        setChurnRisks(await churnRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch revenue data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Revenue Intelligence</h2>
          <p className="text-muted-foreground">
            Métriques SaaS en temps réel - SOTA 2026
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="MRR"
          value={formatCurrency(metrics?.mrr || 0)}
          change={metrics?.growth_rate}
          changeLabel="vs mois dernier"
          icon={CreditCard}
        />
        <MetricCard
          title="ARR"
          value={formatCurrency(metrics?.arr || 0)}
          icon={TrendingUp}
        />
        <MetricCard
          title="NRR"
          value={`${metrics?.nrr.toFixed(1) || 0}%`}
          icon={metrics?.nrr >= 100 ? TrendingUp : TrendingDown}
        />
        <MetricCard
          title="Churn Rate"
          value={`${metrics?.churn_rate.toFixed(2) || 0}%`}
          change={metrics?.churn_rate}
          inverse={true}
          icon={AlertTriangle}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="mrr">Analyse MRR</TabsTrigger>
          <TabsTrigger value="churn">Risque Churn</TabsTrigger>
          <TabsTrigger value="cohorts">Cohortes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="ARPU"
              value={formatCurrency(metrics?.arpu || 0)}
              icon={Users}
            />
            <MetricCard
              title="ARPPU"
              value={formatCurrency(metrics?.arppu || 0)}
              icon={Users}
            />
            <MetricCard
              title="LTV"
              value={formatCurrency(metrics?.ltv || 0)}
              icon={TrendingUp}
            />
            <MetricCard
              title="Quick Ratio"
              value={metrics?.quick_ratio.toFixed(2) || '0'}
              icon={metrics?.quick_ratio >= 4 ? TrendingUp : TrendingDown}
            />
            <MetricCard
              title="GRR"
              value={`${metrics?.grr.toFixed(1) || 0}%`}
              icon={TrendingUp}
            />
            <MetricCard
              title="Revenue Churn"
              value={`${metrics?.revenue_churn_rate.toFixed(2) || 0}%`}
              inverse={true}
              icon={AlertTriangle}
            />
          </div>
        </TabsContent>

        <TabsContent value="mrr" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>MRR Waterfall</CardTitle>
                <CardDescription>
                  Évolution du MRR sur les 6 derniers mois
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MRRWaterfallChart data={waterfall} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Décomposition MRR</CardTitle>
                <CardDescription>
                  Sources de revenus ce mois
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nouveau MRR</span>
                  <span className="font-medium text-green-500">
                    +{formatCurrency(metrics?.mrr_new || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expansion MRR</span>
                  <span className="font-medium text-green-500">
                    +{formatCurrency(metrics?.mrr_expansion || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Réactivation MRR</span>
                  <span className="font-medium text-green-500">
                    +{formatCurrency(metrics?.mrr_reactivation || 0)}
                  </span>
                </div>
                <hr />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contraction MRR</span>
                  <span className="font-medium text-red-500">
                    -{formatCurrency(metrics?.mrr_contraction || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Churn MRR</span>
                  <span className="font-medium text-red-500">
                    -{formatCurrency(metrics?.mrr_churn || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="churn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Comptes à Risque
              </CardTitle>
              <CardDescription>
                Clients avec le plus haut risque de churn (prédiction AI)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {churnRisks.length > 0 ? (
                <ChurnRiskList predictions={churnRisks} />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Aucun compte à haut risque détecté
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohorts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyse par Cohorte</CardTitle>
              <CardDescription>
                Rétention des clients par mois d'acquisition
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Visualisation des cohortes à venir
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RevenueDashboard;
