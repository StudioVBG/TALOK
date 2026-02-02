// =====================================================
// Page: Dashboard Syndic
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteCard } from "@/components/copro/site-card";
import { AssemblyCard } from "@/components/copro/assembly-card";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  Building2, Users, Euro, Calendar,
  Plus, TrendingUp, AlertTriangle,
  ChevronRight, FileText, Bell
} from "lucide-react";
import Link from "next/link";
import type { Site } from "@/lib/types/copro";
import type { AssemblySummary } from "@/lib/types/copro-assemblies";

interface DashboardStats {
  total_sites: number;
  total_units: number;
  total_owners: number;
  total_balance_due: number;
  unpaid_count: number;
  upcoming_assemblies: number;
}

export default function SyndicDashboardPage() {
  const { user, profile } = useAuth();
  const { isSyndic, isPlatformAdmin } = usePermissions();
  const [sites, setSites] = useState<Site[]>([]);
  const [assemblies, setAssemblies] = useState<AssemblySummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Récupérer les sites
        const sitesRes = await fetch('/api/copro/sites');
        if (sitesRes.ok) {
          setSites(await sitesRes.json());
        }

        // Récupérer les AG à venir
        const assembliesRes = await fetch('/api/copro/assemblies?upcoming=true');
        if (assembliesRes.ok) {
          setAssemblies(await assembliesRes.json());
        }

        // TODO: Récupérer les stats globales
        setStats({
          total_sites: 0,
          total_units: 0,
          total_owners: 0,
          total_balance_due: 0,
          unpaid_count: 0,
          upcoming_assemblies: 0,
        });
      } catch (error) {
        console.error('Erreur chargement dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Premier accès : afficher l'onboarding
  if (sites.length === 0) {
    return <FirstTimeOnboarding />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-white">
              Bonjour {(profile as any)?.first_name || (profile as any)?.prenom || 'Syndic'} 👋
            </h1>
            <p className="text-slate-400">
              Bienvenue sur votre espace de gestion
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-white/10 text-white">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </Button>
            <Link href="/syndic/onboarding/profile">
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle copropriété
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats globales */}
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
            value={sites.reduce((sum, s: any) => sum + (s.units?.[0]?.count || 0), 0)}
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
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mes copropriétés */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                  Mes copropriétés
                </h2>
                <Link href="/syndic/sites">
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
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
                    <SiteCard site={site as any} showActions={false} />
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Actions rapides */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Actions rapides</CardTitle>
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* AG à venir */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-violet-400" />
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
                    <div className="text-center py-6 text-slate-400">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucune AG programmée</p>
                    </div>
                  )}
                  <Link href="/syndic/assemblies">
                    <Button 
                      variant="ghost" 
                      className="w-full text-slate-400 hover:text-white"
                    >
                      Voir toutes les AG
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Alertes */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    Alertes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <AlertItem
                    type="warning"
                    message="3 contrats arrivent à échéance ce mois"
                  />
                  <AlertItem
                    type="danger"
                    message="5 lots en impayé depuis plus de 60 jours"
                  />
                  <AlertItem
                    type="info"
                    message="Budget 2025 à valider avant le 31/12"
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composants auxiliaires
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color,
  alert 
}: { 
  icon: any; 
  label: string; 
  value: number; 
  color: string;
  alert?: boolean;
}) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    violet: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    red: { bg: 'bg-red-500/20', text: 'text-red-400' },
    emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  };

  return (
    <Card className={`border-white/10 bg-white/5 ${alert ? 'animate-pulse' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color].bg}`}>
            <Icon className={`w-5 h-5 ${colorClasses[color].text}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-400">{label}</p>
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
  color 
}: { 
  icon: any; 
  label: string; 
  href: string; 
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'hover:bg-cyan-500/10 hover:border-cyan-500/50',
    violet: 'hover:bg-violet-500/10 hover:border-violet-500/50',
    amber: 'hover:bg-amber-500/10 hover:border-amber-500/50',
    emerald: 'hover:bg-emerald-500/10 hover:border-emerald-500/50',
  };

  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`p-4 rounded-lg border border-white/10 text-center cursor-pointer transition-colors ${colorClasses[color]}`}
      >
        <Icon className="w-6 h-6 mx-auto mb-2 text-slate-400" />
        <p className="text-xs text-slate-300">{label}</p>
      </motion.div>
    </Link>
  );
}

function AlertItem({ type, message }: { type: 'info' | 'warning' | 'danger'; message: string }) {
  const colors = {
    info: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    danger: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[type]}`}>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <Skeleton className="h-12 w-64 bg-white/10" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 bg-white/10" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 bg-white/10" />
          <Skeleton className="h-64 bg-white/10" />
        </div>
      </div>
    </div>
  );
}

function FirstTimeOnboarding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg text-center"
      >
        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-6">
          <Building2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">
          Bienvenue sur votre espace Syndic !
        </h1>
        <p className="text-slate-400 mb-8">
          Commencez par créer votre première copropriété pour gérer vos bâtiments, 
          lots, charges et assemblées générales.
        </p>
        <Link href="/syndic/onboarding/profile">
          <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-600">
            <Plus className="w-5 h-5 mr-2" />
            Créer ma première copropriété
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}

