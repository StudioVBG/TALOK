// =====================================================
// Page: Dashboard Syndic
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteCard } from "@/components/copro/site-card";
import { AssemblyCard } from "@/components/copro/assembly-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  Building2, Users, Euro, Calendar,
  Plus, AlertTriangle,
  ChevronRight, FileText, Bell
} from "lucide-react";
import Link from "next/link";
import type { Site } from "@/lib/types/copro";
import type { AssemblySummary } from "@/lib/types/copro-assemblies";

interface SyndicProfile {
  first_name?: string;
  prenom?: string;
  last_name?: string;
  nom?: string;
}

interface DashboardStats {
  total_sites: number;
  total_units: number;
  total_owners: number;
  total_balance_due: number;
  unpaid_count: number;
  upcoming_assemblies: number;
}

export default function SyndicDashboardPage() {
  const { profile } = useAuth();
  const typedProfile = profile as SyndicProfile | null;
  const [sites, setSites] = useState<Site[]>([]);
  const [assemblies, setAssemblies] = useState<AssemblySummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [sitesRes, assembliesRes] = await Promise.all([
          fetch("/api/copro/sites"),
          fetch("/api/copro/assemblies?upcoming=true"),
        ]);

        if (sitesRes.ok) {
          const sitesData = await sitesRes.json();
          setSites(sitesData);

          const totalUnits = sitesData.reduce(
            (sum: number, s: Site) =>
              sum + ((s as Site & { units?: Array<{ count: number }>; total_units?: number }).units?.[0]?.count || (s as Site & { total_units?: number }).total_units || 0),
            0
          );
          const totalBalanceDue = sitesData.reduce(
            (sum: number, s: Site) => sum + ((s as Site & { total_balance_due?: number }).total_balance_due || 0),
            0
          );
          const unpaidCount = sitesData.reduce(
            (sum: number, s: Site) => sum + ((s as Site & { unpaid_count?: number }).unpaid_count || 0),
            0
          );

          setStats({
            total_sites: sitesData.length,
            total_units: totalUnits,
            total_owners: 0,
            total_balance_due: totalBalanceDue,
            unpaid_count: unpaidCount,
            upcoming_assemblies: 0,
          });
        } else {
          throw new Error("Impossible de charger les copropriétés");
        }

        if (assembliesRes.ok) {
          const assembliesData = await assembliesRes.json();
          setAssemblies(assembliesData);
          setStats((prev) =>
            prev ? { ...prev, upcoming_assemblies: assembliesData.length } : prev
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors du chargement du tableau de bord");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (sites.length === 0) {
    return <FirstTimeOnboarding />;
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bonjour {typedProfile?.first_name || typedProfile?.prenom || 'Syndic'} 👋
          </h1>
          <p className="text-muted-foreground">
            Bienvenue sur votre espace de gestion
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </Link>
          </Button>
          <Link href="/syndic/onboarding/profile">
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle copropriété
            </Button>
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatCard
          icon={Building2}
          label="Copropriétés"
          value={sites.length}
          color="cyan"
        />
        <StatCard
          icon={Users}
          label="Lots gérés"
          value={sites.reduce((sum, s) => sum + ((s as Site & { units?: Array<{ count: number }> }).units?.[0]?.count || 0), 0)}
          color="violet"
        />
        <StatCard
          icon={Calendar}
          label="AG à venir"
          value={assemblies.length}
          color="amber"
        />
        <StatCard
          icon={Euro}
          label="Impayés"
          value={stats?.unpaid_count || 0}
          color="red"
          alert={stats ? stats.unpaid_count > 0 : undefined}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-600" />
                Mes copropriétés
              </h2>
              <Link href="/syndic/sites">
                <Button variant="ghost" size="sm">
                  Voir tout
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sites.slice(0, 4).map((site, index) => (
                <motion.div
                  key={site.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <SiteCard site={site} showActions={false} />
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <QuickAction
                    icon={FileText}
                    label="Saisir une facture"
                    href="/syndic/expenses/new"
                    color="emerald"
                  />
                  <QuickAction
                    icon={Euro}
                    label="Appel de fonds"
                    href="/syndic/calls/new"
                    color="amber"
                  />
                  <QuickAction
                    icon={Calendar}
                    label="Planifier une AG"
                    href="/syndic/assemblies/new"
                    color="violet"
                  />
                  <QuickAction
                    icon={Users}
                    label="Inviter un copro"
                    href="/syndic/invites"
                    color="cyan"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-violet-600" />
                  Prochaines AG
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assemblies.length > 0 ? (
                  assemblies.slice(0, 3).map((assembly) => (
                    <AssemblyCard
                      key={assembly.id}
                      assembly={assembly}
                      compact
                    />
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucune AG programmée</p>
                  </div>
                )}
                <Link href="/syndic/assemblies">
                  <Button
                    variant="ghost"
                    className="w-full"
                  >
                    Voir toutes les AG
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Alertes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats && stats.unpaid_count > 0 && (
                  <AlertItem
                    type="danger"
                    message={`${stats.unpaid_count} lot(s) en impayé`}
                  />
                )}
                {assemblies.length > 0 && (
                  <AlertItem
                    type="info"
                    message={`${assemblies.length} assemblée(s) générale(s) à venir`}
                  />
                )}
                {stats && stats.unpaid_count === 0 && assemblies.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Aucune alerte
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  alert?: boolean;
}) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
    violet: { bg: 'bg-violet-100', text: 'text-violet-700' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
    red: { bg: 'bg-red-100', text: 'text-red-700' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  };

  return (
    <Card className={alert ? 'animate-pulse' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color].bg}`}>
            <Icon className={`w-5 h-5 ${colorClasses[color].text}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  color,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'hover:bg-cyan-50 hover:border-cyan-300',
    violet: 'hover:bg-violet-50 hover:border-violet-300',
    amber: 'hover:bg-amber-50 hover:border-amber-300',
    emerald: 'hover:bg-emerald-50 hover:border-emerald-300',
  };

  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`p-4 rounded-lg border border-border text-center cursor-pointer transition-colors ${colorClasses[color]}`}
      >
        <Icon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-foreground">{label}</p>
      </motion.div>
    </Link>
  );
}

function AlertItem({ type, message }: { type: 'info' | 'warning' | 'danger'; message: string }) {
  const colors = {
    info: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    danger: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[type]}`}>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function FirstTimeOnboarding() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg text-center"
      >
        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-6">
          <Building2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Bienvenue sur votre espace Syndic !
        </h1>
        <p className="text-muted-foreground mb-8">
          Commencez par créer votre première copropriété pour gérer vos bâtiments,
          lots, charges et assemblées générales.
        </p>
        <Link href="/syndic/onboarding/profile">
          <Button size="lg" className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
            <Plus className="w-5 h-5 mr-2" />
            Créer ma première copropriété
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
