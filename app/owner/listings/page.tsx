"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Megaphone, Search, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { useListings, useTogglePublishListing } from "@/lib/hooks/queries/use-listings";
import { ListingCard } from "@/features/candidatures/components/ListingCard";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useToast } from "@/components/ui/use-toast";

export default function OwnerListingsPage() {
  const { data: listings = [], isLoading } = useListings();
  const togglePublish = useTogglePublishListing();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredListings = listings.filter((listing) => {
    // Filtre recherche
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const matchesTitle = listing.title.toLowerCase().includes(q);
      const matchesAddress = listing.property?.adresse_complete?.toLowerCase().includes(q);
      const matchesCity = listing.property?.ville?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesAddress && !matchesCity) return false;
    }

    // Filtre statut
    if (statusFilter === "published" && !listing.is_published) return false;
    if (statusFilter === "draft" && listing.is_published) return false;

    return true;
  });

  const handlePublishToggle = async (id: string) => {
    try {
      const result = await togglePublish.mutateAsync(id);
      toast({
        title: result.published ? "Annonce publiée" : "Annonce dépubliée",
        description: result.published
          ? "Votre annonce est maintenant visible publiquement."
          : "Votre annonce n'est plus visible.",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de modifier la publication.",
        variant: "destructive",
      });
    }
  };

  const stats = {
    total: listings.length,
    published: listings.filter((l) => l.is_published).length,
    totalApplications: listings.reduce((sum, l) => sum + l.applications_count, 0),
  };

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <PageTransition>
        <div className="container mx-auto px-4 py-4 md:py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between md:mb-8">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent dark:from-slate-100 dark:via-blue-200 dark:to-slate-100">
                Mes annonces
              </h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-lg">
                Publiez vos annonces et recevez des candidatures
              </p>
            </div>
            <Button
              asChild
              className="shrink-0 text-white shadow-lg"
              style={{ background: "linear-gradient(to right, #2563eb, #4f46e5)" }}
            >
              <Link href="/owner/listings/new">
                <Plus className="mr-2 h-4 w-4" />
                Créer une annonce
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Megaphone className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Annonce{stats.total !== 1 ? "s" : ""}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Eye className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.published}</p>
                  <p className="text-xs text-muted-foreground">Publiée{stats.published !== 1 ? "s" : ""}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Megaphone className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalApplications}</p>
                  <p className="text-xs text-muted-foreground">Candidature{stats.totalApplications !== 1 ? "s" : ""}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre, adresse..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="published">Publiées</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-40 bg-muted" />
                  <CardHeader><div className="h-5 bg-muted rounded w-3/4" /></CardHeader>
                  <CardContent><div className="h-4 bg-muted rounded w-1/2" /></CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Liste */}
          {!isLoading && filteredListings.length === 0 && (
            <EmptyState
              title={listings.length === 0 ? "Aucune annonce" : "Aucun résultat"}
              description={
                listings.length === 0
                  ? "Créez votre première annonce pour commencer à recevoir des candidatures."
                  : "Aucune annonce ne correspond à vos critères."
              }
            />
          )}

          {!isLoading && filteredListings.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onPublishToggle={handlePublishToggle}
                  publishLoading={togglePublish.isPending}
                />
              ))}
            </motion.div>
          )}
        </div>
      </PageTransition>
    </ProtectedRoute>
  );
}
