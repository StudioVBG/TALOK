"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Users,
  Building2,
  Euro,
  Mail,
  Phone,
  MoreHorizontal,
  Eye,
  FileText,
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

interface MandateApi {
  id: string;
  status: string;
  biensCount: number;
  createdAt: string | null;
  owner: {
    id: string | null;
    name: string;
    email: string | null;
    phone: string | null;
  };
}

interface OwnerCard {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  biensCount: number;
  mandatesCount: number;
  mandatStatus: "active" | "pending" | "draft" | "other";
  since: string | null;
}

const STATUS_PRIORITY: Record<string, number> = {
  active: 4,
  pending: 3,
  draft: 2,
  expired: 1,
  terminated: 0,
};

const aggregateOwners = (mandates: MandateApi[]): OwnerCard[] => {
  const map = new Map<string, OwnerCard>();
  for (const m of mandates) {
    const ownerId = m.owner?.id;
    if (!ownerId) continue;

    const existing = map.get(ownerId);
    const status: OwnerCard["mandatStatus"] =
      m.status === "active" || m.status === "pending" || m.status === "draft"
        ? m.status
        : "other";

    if (!existing) {
      map.set(ownerId, {
        id: ownerId,
        name: m.owner.name || "—",
        email: m.owner.email,
        phone: m.owner.phone,
        biensCount: m.biensCount ?? 0,
        mandatesCount: 1,
        mandatStatus: status,
        since: m.createdAt,
      });
    } else {
      existing.biensCount += m.biensCount ?? 0;
      existing.mandatesCount += 1;
      const a = STATUS_PRIORITY[existing.mandatStatus] ?? -1;
      const b = STATUS_PRIORITY[status] ?? -1;
      if (b > a) existing.mandatStatus = status;
      if (m.createdAt && (!existing.since || m.createdAt < existing.since)) {
        existing.since = m.createdAt;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const formatSince = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

export default function OwnersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [owners, setOwners] = useState<OwnerCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/agency/mandates?limit=200");
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Erreur de chargement");
        }
        const data = (await response.json()) as { mandates: MandateApi[] };
        if (cancelled) return;
        setOwners(aggregateOwners(data.mandates ?? []));
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur inconnue");
          setOwners([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOwners = useMemo(
    () =>
      owners.filter(
        (owner) =>
          owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (owner.email ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [owners, searchQuery],
  );

  const totalBiens = owners.reduce((sum, o) => sum + o.biensCount, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Propriétaires mandants
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos relations avec les propriétaires
          </p>
        </div>
        <Button
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
          asChild
        >
          <Link href="/agency/owners/invite">
            <Plus className="w-4 h-4 mr-2" />
            Inviter un propriétaire
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50/60 dark:bg-red-900/20">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{owners.length}</p>
              <p className="text-sm text-muted-foreground">Propriétaires</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalBiens}</p>
              <p className="text-sm text-muted-foreground">Biens gérés</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Euro className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {owners.reduce((sum, o) => sum + o.mandatesCount, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Mandats actifs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un propriétaire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="py-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Chargement…
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOwners.map((owner) => (
              <motion.div
                key={owner.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 border-2 border-indigo-200">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold">
                            {owner.name
                              .split(" ")
                              .map((n) => n[0])
                              .filter(Boolean)
                              .slice(0, 2)
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{owner.name}</h3>
                          <Badge
                            variant="outline"
                            className="text-xs mt-1 border-slate-400 text-slate-600"
                          >
                            {owner.mandatesCount} mandat{owner.mandatesCount > 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/agency/owners/${owner.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir le profil
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/agency/mandates?owner=${owner.id}`}>
                              <FileText className="w-4 h-4 mr-2" />
                              Voir les mandats
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{owner.email ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{owner.phone ?? "—"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-indigo-600">{owner.biensCount}</p>
                        <p className="text-xs text-muted-foreground">Biens</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-600">
                          {owner.mandatesCount}
                        </p>
                        <p className="text-xs text-muted-foreground">Mandats</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatSince(owner.since)
                          ? `Client depuis ${formatSince(owner.since)}`
                          : "—"}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          owner.mandatStatus === "active" &&
                            "border-emerald-500 text-emerald-600 bg-emerald-50",
                          owner.mandatStatus === "pending" &&
                            "border-amber-500 text-amber-600 bg-amber-50",
                          owner.mandatStatus === "draft" &&
                            "border-slate-400 text-slate-600 bg-slate-50",
                          owner.mandatStatus === "other" &&
                            "border-slate-300 text-slate-500 bg-slate-50",
                        )}
                      >
                        {owner.mandatStatus === "active"
                          ? "Mandat actif"
                          : owner.mandatStatus === "pending"
                            ? "En attente"
                            : owner.mandatStatus === "draft"
                              ? "Brouillon"
                              : "Autre"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {filteredOwners.length === 0 && (
            <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {owners.length === 0
                    ? "Aucun propriétaire mandataire pour le moment."
                    : "Aucun propriétaire ne correspond à votre recherche."}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}
