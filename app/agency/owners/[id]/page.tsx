"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  User,
  FileText,
  Euro,
  Receipt,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " EUR";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function OwnerPortalPage() {
  const params = useParams();
  const ownerId = params.id as string;

  // Fetch owner's mandates and associated data
  const { data, isLoading } = useQuery({
    queryKey: ["agency-owner", ownerId],
    queryFn: async () => {
      // Fetch owner profile
      const profileRes = await fetch(`/api/agency/profile?owner_id=${ownerId}`);

      // Fetch mandates for this owner via the mandates API with filtering
      const mandatesRes = await fetch(`/api/agency/mandates?owner_id=${ownerId}`);

      const [profileData, mandatesData] = await Promise.all([
        profileRes.ok ? profileRes.json() : { profile: null },
        mandatesRes.ok ? mandatesRes.json() : { mandates: [] },
      ]);

      return {
        profile: profileData.profile,
        mandates: mandatesData.mandates || [],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const profile = data?.profile;
  const mandates = data?.mandates || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Back link */}
      <motion.div variants={itemVariants}>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/agency/owners">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux proprietaires
          </Link>
        </Button>
      </motion.div>

      {/* Owner header */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                {(profile?.prenom || profile?.nom || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {profile?.prenom || ""} {profile?.nom || "Proprietaire"}
                </h1>
                <p className="text-white/80">{profile?.email || ""}</p>
                {profile?.telephone && (
                  <p className="text-white/70 text-sm">{profile.telephone}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mandates.length}</p>
              <p className="text-xs text-muted-foreground">Mandats</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mandates.reduce((sum: number, m: any) => sum + (m.property_ids?.length || 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Biens sous mandat</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Euro className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mandates.filter((m: any) => m.status === "active").length}
              </p>
              <p className="text-xs text-muted-foreground">Mandats actifs</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Mandates list */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Mandats de gestion</CardTitle>
            <CardDescription>Liste des mandats pour ce proprietaire</CardDescription>
          </CardHeader>
          <CardContent>
            {mandates.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Aucun mandat pour ce proprietaire
              </div>
            ) : (
              <div className="space-y-3">
                {mandates.map((mandate: any) => (
                  <Link
                    key={mandate.id}
                    href={`/agency/mandates/${mandate.id}`}
                    className="block p-4 rounded-xl border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{mandate.mandate_number || "Mandat"}</p>
                          <p className="text-xs text-muted-foreground">
                            {mandate.mandate_type === "gestion" ? "Gestion locative" : mandate.mandate_type}
                            {" — "}
                            Debut : {formatDate(mandate.start_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {mandate.management_fee_rate && (
                          <span className="text-sm font-semibold text-indigo-600">
                            {mandate.management_fee_rate}%
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            mandate.status === "active" && "border-emerald-500 text-emerald-600 bg-emerald-50",
                            mandate.status === "draft" && "border-slate-500 text-slate-600",
                            mandate.status === "terminated" && "border-red-500 text-red-600 bg-red-50"
                          )}
                        >
                          {mandate.status === "active" ? "Actif" :
                           mandate.status === "draft" ? "Brouillon" :
                           mandate.status === "terminated" ? "Resilie" : mandate.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
