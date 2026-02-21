"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Search, Eye, Building2, Users, Wrench, ChevronLeft, ChevronRight } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface PeopleClientProps {
  activeTab: "owners" | "tenants" | "vendors";
  initialData: { users: any[]; total: number }; // Données de l'onglet actif uniquement
  currentPage: number;
  currentSearch: string;
}

export function PeopleClient({ activeTab, initialData, currentPage, currentSearch }: PeopleClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State local pour l'input de recherche (pour éviter de update l'URL à chaque frappe)
  const [searchInput, setSearchInput] = useState(currentSearch);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Synchroniser l'URL quand le debounce change
  useEffect(() => {
    if (debouncedSearch !== currentSearch) {
      updateUrl({ search: debouncedSearch, page: 1 }); // Reset page on search
    }
  }, [debouncedSearch, currentSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateUrl = (updates: { tab?: string; page?: number; search?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (updates.tab) {
      params.set("tab", updates.tab);
      params.set("page", "1"); // Reset page on tab change
      params.set("search", ""); // Reset search on tab change (optionnel, mais souvent mieux)
      setSearchInput(""); // Clear input
    }
    
    if (updates.page) params.set("page", updates.page.toString());
    
    if (updates.search !== undefined) {
      if (updates.search) params.set("search", updates.search);
      else params.delete("search");
    }

    // Use replace for search updates to preserve back button history
    if (updates.search !== undefined && !updates.tab) {
      router.replace(`${pathname}?${params.toString()}`);
    } else {
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const totalPages = Math.ceil(initialData.total / 20);

  // Fonction pour générer l'URL correcte selon le type
  const getDetailUrl = (userId: string) => {
    // Les locataires ont leur propre section /admin/tenants/
    if (activeTab === "tenants") {
      return `/admin/tenants/${userId}`;
    }
    // Les autres restent dans /admin/people/
    return `/admin/people/${activeTab}/${userId}`;
  };

  const columns = [
    {
      header: "Nom",
      cell: (user: any) => <span className="font-medium">{user.prenom} {user.nom}</span>
    },
    {
      header: "Email",
      cell: (user: any) => user.user?.email || user.email || "-"
    },
    {
      header: "Téléphone",
      cell: (user: any) => user.telephone || "-"
    },
    {
      header: "Actions",
      cell: (user: any) => (
        <Link href={getDetailUrl(user.id)}>
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4 mr-1" />
            Voir
          </Button>
        </Link>
      )
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Annuaire</h1>
        <p className="text-muted-foreground">
          Gestion des propriétaires, locataires et prestataires
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recherche</CardTitle>
              <CardDescription>
                Rechercher par nom, email ou téléphone
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs 
            value={activeTab} 
            onValueChange={(v) => updateUrl({ tab: v })}
          >
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="owners">
                <Building2 className="mr-2 h-4 w-4" />
                Propriétaires
              </TabsTrigger>
              <TabsTrigger value="tenants">
                <Users className="mr-2 h-4 w-4" />
                Locataires
              </TabsTrigger>
              <TabsTrigger value="vendors">
                <Wrench className="mr-2 h-4 w-4" />
                Prestataires
              </TabsTrigger>
            </TabsList>

            {/* Contenu Unique (rechargé par le serveur selon l'onglet) */}
            <div className="space-y-4">
              <ResponsiveTable
                data={initialData.users}
                columns={columns}
                keyExtractor={(user) => user.id}
                emptyMessage="Aucun utilisateur trouvé"
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => updateUrl({ page: currentPage - 1 })}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="flex items-center px-2 text-sm">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => updateUrl({ page: currentPage + 1 })}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
