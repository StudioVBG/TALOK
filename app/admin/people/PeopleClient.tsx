"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Search, Eye, Building2, Users, Wrench, Briefcase, Landmark, ShieldCheck, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { exportCSV } from "@/lib/utils/export-csv";

type PeopleTab = "owners" | "tenants" | "vendors" | "syndics" | "agencies" | "guarantors";

const TAB_TO_ROLE: Record<PeopleTab, string> = {
  owners: "owner",
  tenants: "tenant",
  vendors: "provider",
  syndics: "syndic",
  agencies: "agency",
  guarantors: "guarantor",
};

interface PeopleClientProps {
  activeTab: PeopleTab;
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

    router.push(`${pathname}?${params.toString()}`);
  };

  const totalPages = Math.ceil(initialData.total / 20);

  const getDetailUrl = (userId: string) =>
    `/admin/people/${activeTab}/${userId}`;

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
          Gestion des propriétaires, locataires, prestataires, syndics, agences et garants
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
            <div className="flex items-center gap-2 w-full max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportCSV(
                    initialData.users.map((u: any) => ({
                      nom: `${u.prenom || ""} ${u.nom || ""}`.trim() || "—",
                      email: u.user?.email || u.email || "",
                      telephone: u.telephone || "",
                      role: TAB_TO_ROLE[activeTab],
                      cree_le: u.created_at?.split("T")[0] || "",
                    })),
                    activeTab,
                    { nom: "Nom", email: "Email", telephone: "Telephone", role: "Role", cree_le: "Cree le" }
                  )
                }
                disabled={initialData.users.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs 
            value={activeTab} 
            onValueChange={(v) => updateUrl({ tab: v })}
          >
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-6">
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
              <TabsTrigger value="syndics">
                <Landmark className="mr-2 h-4 w-4" />
                Syndics
              </TabsTrigger>
              <TabsTrigger value="agencies">
                <Briefcase className="mr-2 h-4 w-4" />
                Agences
              </TabsTrigger>
              <TabsTrigger value="guarantors">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Garants
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
