"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Building2,
  FileText,
  CreditCard,
  Ban,
  UserCheck,
  LogIn,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";

interface UserProfile {
  id: string;
  user_id: string;
  role: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  avatar_url: string | null;
  suspended?: boolean;
  created_at: string;
  date_naissance?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
}

interface UserSubscription {
  plan_slug: string;
  plan_name: string;
  status: string;
  current_period_end: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  platform_admin: "Super Admin",
  owner: "Proprietaire",
  tenant: "Locataire",
  provider: "Prestataire",
  guarantor: "Garant",
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const userId = params.id as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [properties, setProperties] = useState<unknown[]>([]);
  const [leases, setLeases] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        if (!res.ok) throw new Error("Erreur");
        const data = await res.json();
        setUser(data.user || data.profile || data);
        setSubscription(data.subscription || null);
        setProperties(data.properties || []);
        setLeases(data.leases || []);
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de charger le profil",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [userId, toast]);

  const handleSuspend = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.user_id || userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suspended: !user.suspended,
          reason: user.suspended ? "Admin reactivation" : "Admin suspension",
        }),
      });
      if (!res.ok) throw new Error("Echec");
      setUser((prev) => prev ? { ...prev, suspended: !prev.suspended } : null);
      toast({
        title: user.suspended ? "Compte reactive" : "Compte suspendu",
      });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleImpersonate = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: user.user_id }),
      });
      if (!res.ok) throw new Error("Echec");
      window.location.href = "/dashboard";
    } catch {
      toast({ title: "Erreur d'impersonification", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-1 rounded-xl" />
          <Skeleton className="h-64 lg:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Utilisateur introuvable</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/admin/users")}>
          Retour a la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {user.prenom || ""} {user.nom || ""}
              {!user.prenom && !user.nom && <span className="text-muted-foreground">Sans nom</span>}
            </h1>
            <p className="text-muted-foreground">{user.email || "Pas d'email"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImpersonate}>
            <LogIn className="w-4 h-4 mr-2" />
            Impersonifier
          </Button>
          <Button
            variant={user.suspended ? "default" : "destructive"}
            onClick={handleSuspend}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : user.suspended ? (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Reactiver
              </>
            ) : (
              <>
                <Ban className="w-4 h-4 mr-2" />
                Suspendre
              </>
            )}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profil */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Badge className={cn(
                    user.role === "admin" || user.role === "platform_admin"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                  )}>
                    {ROLE_LABELS[user.role] || user.role}
                  </Badge>
                  {user.suspended && (
                    <Badge variant="destructive" className="ml-2">Suspendu</Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{user.email || "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{user.telephone || "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Inscrit le {formatDateShort(user.created_at)}</span>
                </div>
                {user.adresse && (
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span>{user.adresse}, {user.code_postal} {user.ville}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Profile ID: {user.id}</p>
                <p>User ID: {user.user_id}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Details */}
        <motion.div
          className="lg:col-span-2 space-y-6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {/* Subscription */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Abonnement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{subscription.plan_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Statut: {subscription.status}
                      {subscription.current_period_end && (
                        <> — Expire le {formatDateShort(subscription.current_period_end)}</>
                      )}
                    </p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    {subscription.plan_slug}
                  </Badge>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Aucun abonnement actif</p>
              )}
            </CardContent>
          </Card>

          {/* Biens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Biens ({properties.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun bien enregistre</p>
              ) : (
                <div className="space-y-2">
                  {properties.slice(0, 5).map((prop: unknown, i: number) => {
                    const p = prop as Record<string, unknown>;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{String(p.name || p.titre || "Bien")}</p>
                          <p className="text-xs text-muted-foreground">{String(p.adresse || "")}</p>
                        </div>
                        <Badge variant="outline">{String(p.type || p.property_type || "")}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Baux */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Baux ({leases.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leases.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun bail</p>
              ) : (
                <div className="space-y-2">
                  {leases.slice(0, 5).map((lease: unknown, i: number) => {
                    const l = lease as Record<string, unknown>;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">Bail #{String(l.id || "").slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">
                            {String(l.statut || l.status || "")}
                          </p>
                        </div>
                        <Badge variant="outline">{String(l.type_bail || "")}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions recentes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Actions admin
              </CardTitle>
              <CardDescription>
                Historique des actions effectuees sur ce compte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Consultez le{" "}
                <Link href="/admin/audit-logs" className="text-primary underline">
                  journal d'audit
                </Link>{" "}
                pour l'historique complet.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
