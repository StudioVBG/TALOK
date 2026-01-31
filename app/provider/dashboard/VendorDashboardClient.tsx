"use client";
// @ts-nocheck

import Link from "next/link";
import {
  Wrench,
  Clock,
  CheckCircle2,
  Euro,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Job {
  id: string;
  ticket_id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  property_address: string;
  property_city: string;
  scheduled_date: string | null;
  estimated_cost: number | null;
  final_cost: number | null;
  created_at: string;
}

interface Props {
  data: {
    jobs: Job[];
    stats: {
      assigned: number;
      in_progress: number;
      done: number;
      total_revenue: number;
    };
  };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  assigned: { label: "À accepter", color: "bg-amber-100 text-amber-800" },
  scheduled: { label: "Planifié", color: "bg-blue-100 text-blue-800" },
  done: { label: "Terminé", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Annulé", color: "bg-gray-100 text-gray-800" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  basse: { label: "Basse", color: "bg-gray-100 text-gray-600" },
  normale: { label: "Normale", color: "bg-blue-100 text-blue-600" },
  haute: { label: "Urgente", color: "bg-red-100 text-red-600" },
};

export function VendorDashboardClient({ data }: Props) {
  const pendingJobs = data.jobs.filter(
    (j) => j.status === "assigned" || j.status === "scheduled"
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Gérez vos missions et interventions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">À accepter</p>
                <p className="text-2xl font-bold text-amber-600">{data.stats.assigned}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En cours</p>
                <p className="text-2xl font-bold text-blue-600">{data.stats.in_progress}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-50">
                <Wrench className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Terminés</p>
                <p className="text-2xl font-bold text-green-600">{data.stats.done}</p>
              </div>
              <div className="p-3 rounded-full bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CA total</p>
                <p className="text-2xl font-bold">{data.stats.total_revenue.toLocaleString("fr-FR")} €</p>
              </div>
              <div className="p-3 rounded-full bg-gray-100">
                <Euro className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Jobs Alert */}
      {data.stats.assigned > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800">
                  {data.stats.assigned} mission{data.stats.assigned > 1 ? "s" : ""} en attente
                </p>
                <p className="text-sm text-amber-700">
                  Acceptez ou refusez les missions qui vous sont proposées
                </p>
              </div>
              <Button asChild>
                <Link href="/provider/jobs">
                  Voir les missions
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Missions récentes</CardTitle>
          <CardDescription>Vos dernières interventions</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingJobs.length > 0 ? (
            <div className="space-y-4">
              {pendingJobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex items-start justify-between p-4 rounded-lg border"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{job.title}</h3>
                      <Badge className={priorityConfig[job.priority]?.color}>
                        {priorityConfig[job.priority]?.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {job.description}
                    </p>
                    <p className="text-sm">
                      {job.property_address}, {job.property_city}
                    </p>
                    {job.scheduled_date && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(job.scheduled_date).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={statusConfig[job.status]?.color}>
                      {statusConfig[job.status]?.label}
                    </Badge>
                    {job.estimated_cost && (
                      <p className="text-sm font-medium">
                        {job.estimated_cost.toLocaleString("fr-FR")} €
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Aucune mission en cours</h3>
              <p className="text-muted-foreground">
                Les nouvelles missions apparaîtront ici
              </p>
            </div>
          )}
          {data.jobs.length > 5 && (
            <Button asChild variant="outline" className="w-full mt-4">
              <Link href="/provider/jobs">Voir toutes les missions</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/provider/jobs">
                <Wrench className="h-6 w-6 mb-2" />
                <span>Mes missions</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/provider/invoices">
                <Euro className="h-6 w-6 mb-2" />
                <span>Mes factures</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/profile">
                <Calendar className="h-6 w-6 mb-2" />
                <span>Mon profil</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

