"use client";

import { StatsCard } from "@/features/admin/components/stats-card";
import { Users, Home, FileText, Ticket, DollarSign, FolderOpen, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDateShort } from "@/lib/helpers/format";
import type { AdminStatsData } from "../_data/fetchAdminStats";

interface DashboardClientProps {
  stats: AdminStatsData;
}

export function DashboardClient({ stats }: DashboardClientProps) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord Admin</h1>
        <p className="text-muted-foreground">Vue d'ensemble de la plateforme</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Utilisateurs"
          value={stats.totalUsers}
          description={`${stats.usersByRole.owner} propriétaires, ${stats.usersByRole.tenant} locataires`}
          icon={Users}
        />
        <StatsCard
          title="Logements"
          value={stats.totalProperties}
          description="Total des logements enregistrés"
          icon={Home}
        />
        <StatsCard
          title="Baux actifs"
          value={stats.activeLeases}
          description={`Sur ${stats.totalLeases} baux au total`}
          icon={FileText}
        />
        <StatsCard
          title="Factures impayées"
          value={stats.unpaidInvoices}
          description={`Sur ${stats.totalInvoices} factures`}
          icon={DollarSign}
        />
        <StatsCard
          title="Tickets ouverts"
          value={stats.openTickets}
          description={`Sur ${stats.totalTickets} tickets`}
          icon={Ticket}
        />
        <StatsCard
          title="Documents"
          value={stats.totalDocuments}
          description="Total des documents stockés"
          icon={FolderOpen}
        />
        <StatsCard
          title="Articles publiés"
          value={stats.publishedBlogPosts}
          description={`Sur ${stats.totalBlogPosts} articles`}
          icon={BookOpen}
        />
      </div>

      {/* Statistiques détaillées */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs par rôle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Admins</span>
                <span className="font-medium">{stats.usersByRole.admin}</span>
              </div>
              <div className="flex justify-between">
                <span>Propriétaires</span>
                <span className="font-medium">{stats.usersByRole.owner}</span>
              </div>
              <div className="flex justify-between">
                <span>Locataires</span>
                <span className="font-medium">{stats.usersByRole.tenant}</span>
              </div>
              <div className="flex justify-between">
                <span>Prestataires</span>
                <span className="font-medium">{stats.usersByRole.provider}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Baux par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Brouillons</span>
                <span className="font-medium">{stats.leasesByStatus.draft || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>En attente de signature</span>
                <span className="font-medium">{stats.leasesByStatus.pending_signature || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Actifs</span>
                <span className="font-medium text-green-600">
                  {stats.leasesByStatus.active || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Terminés</span>
                <span className="font-medium">{stats.leasesByStatus.terminated || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Factures par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Brouillons</span>
                <span className="font-medium">{stats.invoicesByStatus.draft || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Envoyées</span>
                <span className="font-medium">{stats.invoicesByStatus.sent || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Payées</span>
                <span className="font-medium text-green-600">
                  {stats.invoicesByStatus.paid || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>En retard</span>
                <span className="font-medium text-red-600">
                  {stats.invoicesByStatus.late || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activité récente */}
      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
          <CardDescription>Les 10 dernières activités sur la plateforme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentActivity.length === 0 ? (
              <p className="text-muted-foreground">Aucune activité récente</p>
            ) : (
              stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateShort(activity.date)}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-muted capitalize">
                    {activity.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

