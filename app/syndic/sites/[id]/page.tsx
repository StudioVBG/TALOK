"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Users,
  Home,
  Euro,
  Calendar,
  Settings,
  FileText,
  Loader2,
  Edit,
  Phone,
  Mail,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  total_units: number;
  total_owners: number;
  status: "active" | "inactive";
  created_at: string;
  description?: string;
  syndic_name?: string;
  syndic_email?: string;
  syndic_phone?: string;
}

interface Unit {
  id: string;
  number: string;
  type: string;
  floor: number;
  surface: number;
  tantiemes: number;
  owner_name?: string;
}

export default function SyndicSiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;

  const [site, setSite] = useState<Site | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSite() {
      try {
        const response = await fetch(`/api/copro/sites/${siteId}`);
        if (response.ok) {
          const data = await response.json();
          setSite(data.site || data);
          setUnits(data.units || []);
        }
      } catch (error) {
        console.error("Erreur chargement site:", error);
      } finally {
        setLoading(false);
      }
    }
    if (siteId) fetchSite();
  }, [siteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Site introuvable</h3>
            <p className="text-muted-foreground mb-6">
              Ce site n'existe pas ou vous n'y avez pas accès.
            </p>
            <Button asChild>
              <Link href="/syndic/sites">Retour aux sites</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6">
        <Link
          href="/syndic/sites"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux sites
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{site.name}</h1>
              <Badge
                variant={site.status === "active" ? "default" : "secondary"}
                className={cn(
                  site.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {site.status === "active" ? "Actif" : "Inactif"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {site.address}, {site.postal_code} {site.city}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/syndic/sites/${siteId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Link>
            </Button>
            <Button
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              asChild
            >
              <Link href={`/syndic/assemblies/new?siteId=${siteId}`}>
                <Calendar className="mr-2 h-4 w-4" />
                Planifier AG
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lots</p>
                <p className="text-2xl font-bold">{site.total_units || units.length}</p>
              </div>
              <Home className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Copropriétaires</p>
                <p className="text-2xl font-bold">{site.total_owners || 0}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tantièmes</p>
                <p className="text-2xl font-bold">
                  {units.reduce((sum, u) => sum + (u.tantiemes || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">
                T
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Surface totale</p>
                <p className="text-2xl font-bold">
                  {units.reduce((sum, u) => sum + (u.surface || 0), 0)} m²
                </p>
              </div>
              <Building2 className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="lots" className="space-y-4">
          <TabsList className="bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="lots">Lots</TabsTrigger>
            <TabsTrigger value="owners">Copropriétaires</TabsTrigger>
            <TabsTrigger value="finances">Finances</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="lots">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Lots de la copropriété</CardTitle>
                  <CardDescription>Liste de tous les lots du site</CardDescription>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/syndic/onboarding/units?siteId=${siteId}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter des lots
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {units.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun lot enregistré</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {units.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                            {unit.number}
                          </div>
                          <div>
                            <p className="font-medium">{unit.type}</p>
                            <p className="text-sm text-muted-foreground">
                              Étage {unit.floor} • {unit.surface} m²
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{unit.tantiemes} tantièmes</p>
                          {unit.owner_name && (
                            <p className="text-sm text-muted-foreground">{unit.owner_name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="owners">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Copropriétaires</CardTitle>
                  <CardDescription>Gérez les copropriétaires du site</CardDescription>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/syndic/invites?siteId=${siteId}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Inviter
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Gérez les copropriétaires depuis cette section</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finances">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Finances</CardTitle>
                <CardDescription>Appels de fonds et charges</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-24 flex-col" asChild>
                    <Link href={`/syndic/calls/new?siteId=${siteId}`}>
                      <Euro className="h-6 w-6 mb-2" />
                      Nouvel appel de fonds
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col" asChild>
                    <Link href={`/syndic/expenses/new?siteId=${siteId}`}>
                      <FileText className="h-6 w-6 mb-2" />
                      Nouvelle dépense
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>PV d'assemblées, règlements, etc.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Les documents seront affichés ici</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}

