"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Assembly {
  id: string;
  site_name: string;
  type: "ordinary" | "extraordinary";
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  status: "upcoming" | "in_progress" | "completed" | "cancelled";
  total_owners: number;
  present_owners: number;
  proxy_owners: number;
  resolutions: Resolution[];
}

interface Resolution {
  id: string;
  title: string;
  description: string;
  majority: string;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  status: "pending" | "approved" | "rejected";
}

const statusConfig = {
  upcoming: { label: "À venir", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700" },
  completed: { label: "Terminée", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-700" },
};

export default function CoproAssemblyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assemblyId = params.id as string;

  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAssembly() {
      try {
        // Simulation - en production, appeler l'API
        const mockAssembly: Assembly = {
          id: assemblyId,
          site_name: "Résidence Les Jardins",
          type: "ordinary",
          title: "Assemblée Générale Ordinaire 2024",
          date: "2024-12-15",
          time: "18:00",
          location: "Salle des fêtes - 15 rue de la Mairie, 75001 Paris",
          description: "Ordre du jour : approbation des comptes, budget prévisionnel, travaux.",
          status: "upcoming",
          total_owners: 45,
          present_owners: 0,
          proxy_owners: 0,
          resolutions: [
            {
              id: "1",
              title: "Approbation des comptes 2023",
              description: "Validation des comptes de l'exercice 2023",
              majority: "simple",
              votes_for: 0,
              votes_against: 0,
              votes_abstain: 0,
              status: "pending",
            },
            {
              id: "2",
              title: "Budget prévisionnel 2025",
              description: "Adoption du budget pour l'année 2025",
              majority: "simple",
              votes_for: 0,
              votes_against: 0,
              votes_abstain: 0,
              status: "pending",
            },
            {
              id: "3",
              title: "Ravalement de façade",
              description: "Vote des travaux de ravalement",
              majority: "absolute",
              votes_for: 0,
              votes_against: 0,
              votes_abstain: 0,
              status: "pending",
            },
          ],
        };
        setAssembly(mockAssembly);
      } catch (error) {
        console.error("Erreur chargement assemblée:", error);
      } finally {
        setLoading(false);
      }
    }
    if (assemblyId) fetchAssembly();
  }, [assemblyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!assembly) {
    return (
      <div className="p-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Assemblée introuvable</h3>
            <Button asChild>
              <Link href="/copro/dashboard">Retour au tableau de bord</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[assembly.status];
  const quorum = assembly.total_owners > 0
    ? Math.round(((assembly.present_owners + assembly.proxy_owners) / assembly.total_owners) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/copro/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className={status.color}>{status.label}</Badge>
                <Badge variant="outline">
                  {assembly.type === "ordinary" ? "AG Ordinaire" : "AG Extraordinaire"}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold">{assembly.title}</h1>
              <p className="text-muted-foreground">{assembly.site_name}</p>
            </div>

            {assembly.status === "completed" && (
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Télécharger le PV
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Informations */}
          <Card className="bg-white/80 backdrop-blur-sm md:col-span-2">
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {format(new Date(assembly.date), "EEEE d MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Heure</p>
                    <p className="font-medium">{assembly.time}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lieu</p>
                  <p className="font-medium">{assembly.location}</p>
                </div>
              </div>

              {assembly.description && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p>{assembly.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Participation */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Participation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-indigo-600">{quorum}%</p>
                <p className="text-sm text-muted-foreground">Quorum</p>
              </div>
              <Progress value={quorum} className="h-2" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Présents</span>
                  <span className="font-medium">{assembly.present_owners}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Représentés</span>
                  <span className="font-medium">{assembly.proxy_owners}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Total copropriétaires</span>
                  <span className="font-medium">{assembly.total_owners}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Résolutions */}
        <Card className="bg-white/80 backdrop-blur-sm mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              Ordre du jour ({assembly.resolutions.length} résolutions)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assembly.resolutions.map((resolution, index) => {
                const totalVotes =
                  resolution.votes_for + resolution.votes_against + resolution.votes_abstain;
                const forPercent =
                  totalVotes > 0 ? Math.round((resolution.votes_for / totalVotes) * 100) : 0;

                return (
                  <div
                    key={resolution.id}
                    className="p-4 rounded-lg border border-slate-200 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            Résolution {index + 1}
                          </span>
                          {resolution.status === "approved" && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Adoptée
                            </Badge>
                          )}
                          {resolution.status === "rejected" && (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="h-3 w-3 mr-1" />
                              Rejetée
                            </Badge>
                          )}
                          {resolution.status === "pending" && (
                            <Badge className="bg-slate-100 text-slate-700">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              En attente
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium">{resolution.title}</h4>
                        {resolution.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {resolution.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {totalVotes > 0 && (
                      <div className="space-y-2">
                        <Progress value={forPercent} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Pour: {resolution.votes_for}</span>
                          <span>Contre: {resolution.votes_against}</span>
                          <span>Abstention: {resolution.votes_abstain}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

