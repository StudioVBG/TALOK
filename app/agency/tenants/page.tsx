"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Users,
  Mail,
  Home,
  Euro,
  CheckCircle,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TenantRow {
  tenantId: string;
  leaseId: string;
  name: string;
  email: string | null;
  phone: string | null;
  propertyId: string;
  propertyAddress: string;
  propertyCity: string | null;
  ownerName: string;
  loyer: number;
  since: string | null;
  paymentStatus: "paid" | "pending" | "late" | "unknown";
}

interface ApiResponse {
  tenants: TenantRow[];
  stats: {
    total: number;
    upToDate: number;
    late: number;
    pending: number;
    totalLoyers: number;
  };
}

const statusBadge = (status: TenantRow["paymentStatus"]) => {
  switch (status) {
    case "paid":
      return { label: "À jour", className: "border-emerald-500 text-emerald-600 bg-emerald-50" };
    case "pending":
      return { label: "En attente", className: "border-amber-500 text-amber-600 bg-amber-50" };
    case "late":
      return { label: "En retard", className: "border-red-500 text-red-600 bg-red-50" };
    default:
      return { label: "—", className: "border-slate-300 text-slate-500 bg-slate-50" };
  }
};

export default function AgencyTenantsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [stats, setStats] = useState<ApiResponse["stats"]>({
    total: 0,
    upToDate: 0,
    late: 0,
    pending: 0,
    totalLoyers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/agency/tenants");
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Erreur de chargement");
        }
        const data = (await response.json()) as ApiResponse;
        if (cancelled) return;
        setTenants(data.tenants ?? []);
        setStats(data.stats ?? { total: 0, upToDate: 0, late: 0, pending: 0, totalLoyers: 0 });
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur inconnue");
          setTenants([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTenants = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.email ?? "").toLowerCase().includes(q) ||
        t.propertyAddress.toLowerCase().includes(q),
    );
  }, [tenants, searchQuery]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Locataires
        </h1>
        <p className="text-muted-foreground mt-1">Tous les locataires des biens sous gestion</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50/60 dark:bg-red-900/20">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Locataires</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.upToDate}</p>
              <p className="text-xs text-muted-foreground">À jour</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.late}</p>
              <p className="text-xs text-muted-foreground">En retard</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Euro className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalLoyers.toLocaleString("fr-FR")}€</p>
              <p className="text-xs text-muted-foreground">Loyers/mois</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un locataire, email ou bien…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Chargement…
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {tenants.length === 0
                ? "Aucun locataire actif sur les biens sous mandat."
                : "Aucun locataire ne correspond à votre recherche."}
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3 p-4">
                {filteredTenants.map((tenant) => {
                  const badge = statusBadge(tenant.paymentStatus);
                  return (
                    <div key={tenant.leaseId} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold">
                              {tenant.name
                                .split(" ")
                                .map((n) => n[0])
                                .filter(Boolean)
                                .slice(0, 2)
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground">{tenant.email ?? "—"}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/agency/properties/${tenant.propertyId}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                Voir le bien
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Bien</p>
                          <div className="flex items-center gap-1">
                            <Home className="w-3 h-3 text-muted-foreground" />
                            <span>{tenant.propertyAddress}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Propriétaire</p>
                          <p>{tenant.ownerName}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="font-semibold">{tenant.loyer}€/mois</span>
                        <Badge variant="outline" className={cn("text-xs", badge.className)}>
                          {badge.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Locataire</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Bien</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Propriétaire</th>
                      <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Loyer</th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Statut paiement</th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map((tenant) => {
                      const badge = statusBadge(tenant.paymentStatus);
                      return (
                        <tr
                          key={tenant.leaseId}
                          className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10">
                                <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold">
                                  {tenant.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{tenant.name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {tenant.email ?? "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Home className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{tenant.propertyAddress}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-sm">{tenant.ownerName}</td>
                          <td className="py-4 px-4 text-right font-semibold">{tenant.loyer}€</td>
                          <td className="py-4 px-4 text-center">
                            <Badge variant="outline" className={cn("text-xs", badge.className)}>
                              {badge.label}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/agency/properties/${tenant.propertyId}`}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Voir le bien
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
