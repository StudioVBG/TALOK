"use client";
// @ts-nocheck

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Euro,
  Users,
  Calendar,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Home,
  PiggyBank,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Activity,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { formatCurrency } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  totalProperties: number;
  totalLeases: number;
  occupancyRate: number;
  vacancyDays: number;
  totalMonthlyRent: number;
  totalMonthlyCharges: number;
  totalAnnualRevenue: number;
  totalAnnualExpenses: number;
  netAnnualIncome: number;
  grossYield: number;
  netYield: number;
  collectionRate: number;
  totalUnpaid: number;
  propertiesStats: Array<{
    id: string;
    address: string;
    city: string;
    type: string;
    status: string;
    monthlyRent: number;
    monthlyCharges: number;
    annualRevenue: number;
    occupancyRate: number;
    grossYield: number;
    netYield: number;
  }>;
  monthlyData: Array<{
    month: string;
    revenue: number;
    expenses: number;
    net: number;
    occupancy: number;
  }>;
  tenantsStats: {
    total: number;
    onTime: number;
    late: number;
    avgScore: number;
    avgLeaseDuration: number;
  };
}

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

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// Formatage des mois
const formatMonth = (month: string) => {
  const [year, m] = month.split("-");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${months[parseInt(m) - 1]}`;
};

// Composant KPI Card
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = "blue",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "blue" | "green" | "amber" | "red" | "purple";
}) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    green: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    red: "from-red-500 to-red-600",
    purple: "from-purple-500 to-purple-600",
  };

  const bgColorClasses = {
    blue: "bg-blue-100",
    green: "bg-emerald-100",
    amber: "bg-amber-100",
    red: "bg-red-100",
    purple: "bg-purple-100",
  };

  const textColorClasses = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
    purple: "text-purple-600",
  };

  return (
    <motion.div variants={itemVariants}>
      <GlassCard className="p-5 h-full">
        <div className="flex items-start justify-between">
          <div className={cn("p-2.5 rounded-xl", bgColorClasses[color])}>
            <Icon className={cn("h-5 w-5", textColorClasses[color])} />
          </div>
          {trend && trendValue && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              trend === "up" ? "bg-emerald-100 text-emerald-700" :
              trend === "down" ? "bg-red-100 text-red-700" :
              "bg-slate-100 text-slate-600"
            )}>
              {trend === "up" && <ArrowUpRight className="h-3 w-3" />}
              {trend === "down" && <ArrowDownRight className="h-3 w-3" />}
              {trendValue}
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm font-medium text-slate-600 mt-1">{title}</p>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const [period, setPeriod] = useState("12m");
  const [activeTab, setActiveTab] = useState("overview");

  // Données pour le pie chart
  const occupancyPieData = [
    { name: "Loués", value: data.totalLeases, color: "#10b981" },
    { name: "Vacants", value: data.totalProperties - data.totalLeases, color: "#ef4444" },
  ];

  // Données pour le bar chart par bien
  const propertyBarData = data.propertiesStats.slice(0, 5).map((prop) => ({
    name: prop.address.split(",")[0].slice(0, 15) + "...",
    revenue: prop.annualRevenue,
    yield: prop.grossYield,
  }));

  return (
    <PageTransition>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-6 max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Analytics
            </h1>
            <p className="text-slate-500 mt-1">
              Performance de votre patrimoine immobilier
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] bg-white">
                <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">3 derniers mois</SelectItem>
                <SelectItem value="6m">6 derniers mois</SelectItem>
                <SelectItem value="12m">12 derniers mois</SelectItem>
                <SelectItem value="ytd">Année en cours</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Revenus mensuels"
            value={formatCurrency(data.totalMonthlyRent)}
            subtitle={`${formatCurrency(data.totalAnnualRevenue)}/an`}
            icon={Euro}
            trend="up"
            trendValue="+3.2%"
            color="green"
          />
          <KPICard
            title="Taux d'occupation"
            value={`${data.occupancyRate.toFixed(0)}%`}
            subtitle={`${data.vacancyDays}j de vacance/an`}
            icon={Home}
            trend={data.occupancyRate >= 90 ? "up" : "down"}
            trendValue={data.occupancyRate >= 90 ? "Excellent" : "À améliorer"}
            color={data.occupancyRate >= 90 ? "green" : "amber"}
          />
          <KPICard
            title="Rendement brut"
            value={`${data.grossYield.toFixed(1)}%`}
            subtitle={`Net: ${data.netYield.toFixed(1)}%`}
            icon={TrendingUp}
            trend="up"
            trendValue="+0.3pt"
            color="blue"
          />
          <KPICard
            title="Taux d'encaissement"
            value={`${data.collectionRate.toFixed(0)}%`}
            subtitle={data.totalUnpaid > 0 ? `${formatCurrency(data.totalUnpaid)} impayés` : "Aucun impayé"}
            icon={Target}
            trend={data.collectionRate >= 95 ? "up" : "down"}
            trendValue={data.collectionRate >= 95 ? "Excellent" : "Attention"}
            color={data.collectionRate >= 95 ? "green" : "red"}
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" className="gap-2">
              <Activity className="h-4 w-4" />
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="properties" className="gap-2">
              <Building2 className="h-4 w-4" />
              Par bien
            </TabsTrigger>
            <TabsTrigger value="tenants" className="gap-2">
              <Users className="h-4 w-4" />
              Locataires
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Graphique principal */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Évolution des revenus
                  </CardTitle>
                  <CardDescription>
                    Revenus, charges et résultat net sur les 12 derniers mois
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.monthlyData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={formatMonth}
                          tick={{ fontSize: 12 }}
                          stroke="#94a3b8"
                        />
                        <YAxis
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
                          tick={{ fontSize: 12 }}
                          stroke="#94a3b8"
                        />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => formatMonth(label)}
                          contentStyle={{
                            backgroundColor: "white",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          name="Revenus"
                          stroke="#10b981"
                          fill="url(#colorRevenue)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="net"
                          name="Net"
                          stroke="#3b82f6"
                          fill="url(#colorNet)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Graphiques secondaires */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Occupation */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-emerald-600" />
                      Répartition occupation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={occupancyPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {occupancyPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value} bien(s)`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-3xl font-bold text-slate-900">
                        {data.totalLeases}/{data.totalProperties}
                      </p>
                      <p className="text-sm text-slate-500">biens loués</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Top biens */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PiggyBank className="h-5 w-5 text-amber-600" />
                      Revenus par bien
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={propertyBarData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            type="number"
                            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={100}
                            tick={{ fontSize: 10 }}
                          />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Properties Tab */}
          <TabsContent value="properties" className="space-y-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Performance par bien</CardTitle>
                  <CardDescription>
                    Analyse détaillée de chaque propriété
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bien</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Loyer/mois</TableHead>
                        <TableHead className="text-right">Revenu/an</TableHead>
                        <TableHead className="text-right">Rendement</TableHead>
                        <TableHead className="text-right">Occupation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.propertiesStats.map((prop) => (
                        <TableRow key={prop.id} className="hover:bg-slate-50">
                          <TableCell>
                            <Link href={`/owner/properties/${prop.id}`} className="hover:underline">
                              <div>
                                <p className="font-medium">{prop.address}</p>
                                <p className="text-xs text-slate-500">{prop.city} • {prop.type}</p>
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                prop.status === "loue"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              )}
                            >
                              {prop.status === "loue" ? "Loué" : "Vacant"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(prop.monthlyRent)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(prop.annualRevenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-medium",
                              prop.grossYield >= 6 ? "text-emerald-600" :
                              prop.grossYield >= 4 ? "text-amber-600" : "text-red-600"
                            )}>
                              {prop.grossYield.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    prop.occupancyRate >= 80 ? "bg-emerald-500" :
                                    prop.occupancyRate >= 50 ? "bg-amber-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${prop.occupancyRate}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{prop.occupancyRate}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Tenants Tab */}
          <TabsContent value="tenants" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <KPICard
                title="Total locataires"
                value={data.tenantsStats.total}
                icon={Users}
                color="blue"
              />
              <KPICard
                title="Paiements à l'heure"
                value={`${data.tenantsStats.onTime}/${data.tenantsStats.total}`}
                subtitle={`${((data.tenantsStats.onTime / Math.max(data.tenantsStats.total, 1)) * 100).toFixed(0)}%`}
                icon={CheckCircle2}
                color="green"
              />
              <KPICard
                title="Score moyen"
                value={`${data.tenantsStats.avgScore}/5`}
                icon={Target}
                color="amber"
              />
              <KPICard
                title="Durée moy. bail"
                value={`${data.tenantsStats.avgLeaseDuration} ans`}
                icon={Clock}
                color="purple"
              />
            </div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Statistiques locataires</CardTitle>
                  <CardDescription>
                    Comportement de paiement et fidélité
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Users className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">
                      Consultez la page{" "}
                      <Link href="/owner/tenants" className="text-blue-600 hover:underline font-medium">
                        Mes locataires
                      </Link>
                      {" "}pour plus de détails
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </PageTransition>
  );
}

