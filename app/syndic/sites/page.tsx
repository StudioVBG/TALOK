"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Users,
  Home,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
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
}

export default function SyndicSitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchSites() {
      try {
        const response = await fetch("/api/copro/sites");
        if (response.ok) {
          const data = await response.json();
          setSites(data.sites || data || []);
        }
      } catch (error) {
        console.error("Erreur chargement sites:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSites();
  }, []);

  const filteredSites = sites.filter(
    (site) =>
      site.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: sites.length,
    active: sites.filter((s) => s.status === "active").length,
    totalUnits: sites.reduce((sum, s) => sum + (s.total_units || 0), 0),
    totalOwners: sites.reduce((sum, s) => sum + (s.total_owners || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
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
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Mes sites
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos copropriétés et immeubles
          </p>
        </div>
        <Button
          asChild
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
        >
          <Link href="/syndic/onboarding/site">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau site
          </Link>
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total sites</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Building2 className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sites actifs</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total lots</p>
                <p className="text-2xl font-bold">{stats.totalUnits}</p>
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
                <p className="text-2xl font-bold">{stats.totalOwners}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/80 backdrop-blur-sm"
          />
        </div>
      </motion.div>

      {/* Sites List */}
      {filteredSites.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="py-16 text-center">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun site</h3>
              <p className="text-muted-foreground mb-6">
                {sites.length === 0
                  ? "Vous n'avez pas encore de site. Commencez par en créer un."
                  : "Aucun site ne correspond à votre recherche."}
              </p>
              {sites.length === 0 && (
                <Button asChild>
                  <Link href="/syndic/onboarding/site">
                    <Plus className="mr-2 h-4 w-4" />
                    Créer un site
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredSites.map((site) => (
            <motion.div key={site.id} variants={itemVariants}>
              <Link href={`/syndic/sites/${site.id}`}>
                <Card className="bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-lg transition-all cursor-pointer group h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg group-hover:text-indigo-600 transition-colors">
                        {site.name}
                      </CardTitle>
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
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                          {site.address}
                          <br />
                          {site.postal_code} {site.city}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 pt-2 border-t">
                        <div className="flex items-center gap-1 text-sm">
                          <Home className="h-4 w-4 text-blue-500" />
                          <span>{site.total_units || 0} lots</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-4 w-4 text-purple-500" />
                          <span>{site.total_owners || 0} copro.</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end mt-4 text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Voir le détail
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

