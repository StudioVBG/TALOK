"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Euro, Plus, Calendar, Building2, Users,
  ChevronRight, AlertCircle, CheckCircle2, Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface FundCall {
  id: string;
  title: string;
  type: string;
  total_amount: number;
  status: string;
  due_date: string;
  created_at: string;
  site_name?: string;
  paid_count?: number;
  total_owners?: number;
}

const TYPE_LABELS: Record<string, string> = {
  quarterly: "Trimestriel",
  annual: "Annuel",
  exceptional: "Exceptionnel",
  regularization: "Régularisation",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: Clock },
  sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700", icon: Euro },
  partial: { label: "Partiellement payé", color: "bg-amber-100 text-amber-700", icon: Clock },
  paid: { label: "Soldé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  overdue: { label: "En retard", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

export default function CallsListPage() {
  const [calls, setCalls] = useState<FundCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCalls() {
      try {
        const response = await fetch("/api/copro/calls");
        if (response.ok) {
          const data = await response.json();
          setCalls(data.calls || data || []);
        }
      } catch (error) {
        console.error("Erreur chargement appels de fonds:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCalls();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appels de fonds</h1>
          <p className="text-muted-foreground">
            Gérez les appels de fonds de vos copropriétés
          </p>
        </div>
        <Button asChild className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
          <Link href="/syndic/calls/new">
            <Plus className="h-4 w-4 mr-2" />
            Nouvel appel
          </Link>
        </Button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Euro className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun appel de fonds</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Créez votre premier appel de fonds pour une copropriété.
            </p>
            <Button asChild>
              <Link href="/syndic/calls/new">
                <Plus className="h-4 w-4 mr-2" />
                Créer un appel de fonds
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => {
            const statusConfig = STATUS_CONFIG[call.status] || STATUS_CONFIG.draft;
            const StatusIcon = statusConfig.icon;
            return (
              <Card key={call.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="p-3 rounded-xl bg-cyan-50 text-cyan-600 shrink-0">
                        <Euro className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground truncate">{call.title}</p>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {TYPE_LABELS[call.type] || call.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {call.site_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {call.site_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Échéance : {new Date(call.due_date).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="font-bold text-foreground">
                          {call.total_amount?.toLocaleString("fr-FR")} €
                        </p>
                        {call.paid_count != null && call.total_owners != null && (
                          <p className="text-xs text-muted-foreground">
                            {call.paid_count}/{call.total_owners} payés
                          </p>
                        )}
                      </div>
                      <Badge className={`${statusConfig.color} gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
