// =====================================================
// Page: Dashboard Copropriétaire (Extranet)
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  Building2, Euro, FileText, Calendar, AlertTriangle,
  TrendingUp, TrendingDown, Clock, CheckCircle2,
  Vote, MessageSquare, ChevronRight, Download, Bell
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  sites: Array<{
    id: string;
    name: string;
    my_units: Array<{
      id: string;
      lot_number: string;
      tantieme_general: number;
      balance_due: number;
    }>;
  }>;
  totalBalance: number;
  nextAssembly: {
    id: string;
    label: string;
    scheduled_at: string;
    site_name: string;
    motions_count: number;
  } | null;
  pendingDocuments: number;
  openTickets: number;
  recentCharges: Array<{
    id: string;
    label: string;
    amount: number;
    period: string;
    status: string;
  }>;
}

export default function CoproDashboardPage() {
  const { user, profile } = useAuth();
  const { isCoproprietaire, hasRole } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const isBailleur = hasRole('coproprietaire_bailleur');

  useEffect(() => {
    async function fetchData() {
      try {
        // TODO: Appeler l'API dashboard copropriétaire
        // Pour l'instant, données mockées
        setData({
          sites: [
            {
              id: '1',
              name: 'Résidence Les Oliviers',
              my_units: [
                { id: 'u1', lot_number: '012', tantieme_general: 250, balance_due: 125.50 },
              ],
            },
          ],
          totalBalance: 125.50,
          nextAssembly: {
            id: 'ag1',
            label: 'AGO 2025',
            scheduled_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            site_name: 'Résidence Les Oliviers',
            motions_count: 12,
          },
          pendingDocuments: 3,
          openTickets: 1,
          recentCharges: [
            { id: 'c1', label: 'Charges Q4 2024', amount: 450, period: 'T4 2024', status: 'paid' },
            { id: 'c2', label: 'Charges Q1 2025', amount: 475, period: 'T1 2025', status: 'pending' },
          ],
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

  const nextAssemblyDate = data?.nextAssembly
    ? new Date(data.nextAssembly.scheduled_at)
    : null;
  const daysUntilAG = nextAssemblyDate
    ? Math.ceil((nextAssemblyDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-white">
              Bonjour {profile?.first_name || 'Copropriétaire'} 👋
            </h1>
            <p className="text-slate-400">
              Bienvenue sur votre espace copropriétaire
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-white/10 text-white">
              <Bell className="w-4 h-4 mr-2" />
              <Badge className="bg-red-500 text-white ml-1">2</Badge>
            </Button>
          </div>
        </motion.div>

        {/* Mes lots et solde */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Solde global */}
          <Card className={`border-white/10 ${
            data?.totalBalance && data.totalBalance > 0 
              ? 'bg-gradient-to-br from-red-500/20 to-red-600/10' 
              : 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Mon solde</p>
                  <p className={`text-3xl font-bold ${
                    data?.totalBalance && data.totalBalance > 0 
                      ? 'text-red-400' 
                      : 'text-emerald-400'
                  }`}>
                    {(data?.totalBalance || 0).toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {data?.totalBalance && data.totalBalance > 0 
                      ? 'À régulariser' 
                      : 'À jour'}
                  </p>
                </div>
                <div className={`p-4 rounded-full ${
                  data?.totalBalance && data.totalBalance > 0 
                    ? 'bg-red-500/20' 
                    : 'bg-emerald-500/20'
                }`}>
                  {data?.totalBalance && data.totalBalance > 0 
                    ? <TrendingUp className="w-8 h-8 text-red-400" />
                    : <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  }
                </div>
              </div>
              {data?.totalBalance && data.totalBalance > 0 && (
                <Button className="w-full mt-4 bg-red-500 hover:bg-red-600">
                  <Euro className="w-4 h-4 mr-2" />
                  Payer maintenant
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Prochaine AG */}
          <Card className="border-white/10 bg-gradient-to-br from-violet-500/20 to-violet-600/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Prochaine AG</p>
                  {data?.nextAssembly ? (
                    <>
                      <p className="text-xl font-semibold text-white">
                        {data.nextAssembly.label}
                      </p>
                      <p className="text-sm text-violet-400">
                        {daysUntilAG} jours restants
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-400">Aucune AG programmée</p>
                  )}
                </div>
                <div className="p-4 rounded-full bg-violet-500/20">
                  <Calendar className="w-8 h-8 text-violet-400" />
                </div>
              </div>
              {data?.nextAssembly && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">{data.nextAssembly.motions_count} résolutions</span>
                    <span className="text-violet-400">À voter</span>
                  </div>
                  <Link href={`/copro/assemblies/${data.nextAssembly.id}`}>
                    <Button variant="outline" className="w-full border-violet-500/50 text-violet-400 hover:bg-violet-500/10">
                      <Vote className="w-4 h-4 mr-2" />
                      Consulter l'ordre du jour
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents et tickets */}
          <Card className="border-white/10 bg-white/5">
            <CardContent className="p-6 space-y-4">
              <Link href="/copro/documents">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <FileText className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Documents</p>
                      <p className="text-xs text-slate-400">
                        {data?.pendingDocuments || 0} nouveaux
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </Link>
              <Link href="/copro/tickets">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <MessageSquare className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Signalements</p>
                      <p className="text-xs text-slate-400">
                        {data?.openTickets || 0} en cours
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Mes lots */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Mes lots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.sites.map((site) =>
                  site.my_units.map((unit) => (
                    <motion.div
                      key={unit.id}
                      whileHover={{ x: 4 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-white/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-cyan-500/20">
                          <Building2 className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              Lot n°{unit.lot_number}
                            </span>
                            <Badge variant="outline" className="text-slate-400">
                              {unit.tantieme_general} mill.
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-400">{site.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          unit.balance_due > 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {unit.balance_due.toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </p>
                        <p className="text-xs text-slate-400">
                          {unit.balance_due > 0 ? 'Solde débiteur' : 'À jour'}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Dernières charges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Euro className="w-5 h-5 text-emerald-400" />
                Mes appels de charges
              </CardTitle>
              <Link href="/copro/charges">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  Voir tout
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.recentCharges.map((charge) => (
                  <div
                    key={charge.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        charge.status === 'paid' 
                          ? 'bg-emerald-500/20' 
                          : 'bg-amber-500/20'
                      }`}>
                        {charge.status === 'paid' 
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          : <Clock className="w-4 h-4 text-amber-400" />
                        }
                      </div>
                      <div>
                        <p className="text-white font-medium">{charge.label}</p>
                        <p className="text-xs text-slate-400">{charge.period}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-white">
                          {charge.amount.toLocaleString('fr-FR')} €
                        </p>
                        <Badge className={
                          charge.status === 'paid' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-amber-500/20 text-amber-400'
                        }>
                          {charge.status === 'paid' ? 'Payé' : 'En attente'}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="text-slate-400">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Section bailleur */}
        {isBailleur && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-violet-600/5">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-violet-400" />
                  Espace Bailleur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 mb-4">
                  En tant que copropriétaire bailleur, vous pouvez gérer les charges 
                  récupérables sur vos locataires et effectuer les régularisations annuelles.
                </p>
                <div className="flex gap-3">
                  <Link href="/owner/copro/charges">
                    <Button variant="outline" className="border-violet-500/50 text-violet-400 hover:bg-violet-500/10">
                      Charges récupérables
                    </Button>
                  </Link>
                  <Link href="/owner/copro/regularisation">
                    <Button className="bg-violet-600 hover:bg-violet-700">
                      Régularisation annuelle
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64 bg-white/10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 bg-white/10" />
          ))}
        </div>
        <Skeleton className="h-48 bg-white/10" />
        <Skeleton className="h-48 bg-white/10" />
      </div>
    </div>
  );
}

