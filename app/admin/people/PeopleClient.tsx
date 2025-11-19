"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Search, Eye, Building2, Users, Wrench } from "lucide-react";
// On pourrait importer fetchAdminUsers côté client aussi pour la pagination/recherche dynamique via Server Actions ou API route
// Pour simplifier la migration, on va simuler ou utiliser les données initiales
// Idéalement : Server Actions pour la pagination

interface PeopleClientProps {
  initialData: {
    owners: { users: any[]; total: number };
    tenants: { users: any[]; total: number };
    vendors: { users: any[]; total: number };
  };
}

export function PeopleClient({ initialData }: PeopleClientProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"owners" | "tenants" | "vendors">("owners");
  const [search, setSearch] = useState("");
  
  // Données
  const [owners, setOwners] = useState(initialData.owners.users);
  const [tenants, setTenants] = useState(initialData.tenants.users);
  const [vendors, setVendors] = useState(initialData.vendors.users);
  
  const [totalOwners, setTotalOwners] = useState(initialData.owners.total);
  const [totalTenants, setTotalTenants] = useState(initialData.tenants.total);
  const [totalVendors, setTotalVendors] = useState(initialData.vendors.total);

  // Pagination locale (pour l'instant, car on n'a pas implémenté le refetch côté client via Server Action)
  // TODO: Implémenter fetchAdminUsers via Server Action pour pagination réelle
  const limit = 20;
  const [pages, setPages] = useState({
    owners: 1,
    tenants: 1,
    vendors: 1,
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    // Filtrage client-side basique sur les données chargées
    // En prod : debounce + Server Action
  };

  // Filtrage local
  const filteredOwners = useMemo(() => {
    return owners.filter((u: any) => 
      (u.nom?.toLowerCase().includes(search.toLowerCase()) || 
       u.prenom?.toLowerCase().includes(search.toLowerCase()) || 
       u.user?.email?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [owners, search]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((u: any) => 
      (u.nom?.toLowerCase().includes(search.toLowerCase()) || 
       u.prenom?.toLowerCase().includes(search.toLowerCase()) || 
       u.user?.email?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [tenants, search]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((u: any) => 
      (u.nom?.toLowerCase().includes(search.toLowerCase()) || 
       u.prenom?.toLowerCase().includes(search.toLowerCase()) || 
       u.user?.email?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [vendors, search]);

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
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="owners">
                <Building2 className="mr-2 h-4 w-4" />
                Propriétaires ({totalOwners})
              </TabsTrigger>
              <TabsTrigger value="tenants">
                <Users className="mr-2 h-4 w-4" />
                Locataires ({totalTenants})
              </TabsTrigger>
              <TabsTrigger value="vendors">
                <Wrench className="mr-2 h-4 w-4" />
                Prestataires ({totalVendors})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="owners" className="mt-6">
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOwners.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Aucun propriétaire trouvé
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOwners.map((owner: any) => (
                          <TableRow key={owner.id}>
                            <TableCell className="font-medium">{owner.prenom} {owner.nom}</TableCell>
                            <TableCell>{owner.user?.email || "-"}</TableCell>
                            <TableCell>{owner.telephone || "-"}</TableCell>
                            <TableCell>
                              <Link href={`/admin/people/owners/${owner.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Voir
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
            </TabsContent>

            <TabsContent value="tenants" className="mt-6">
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Aucun locataire trouvé
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTenants.map((tenant: any) => (
                          <TableRow key={tenant.id}>
                            <TableCell className="font-medium">{tenant.prenom} {tenant.nom}</TableCell>
                            <TableCell>{tenant.user?.email || "-"}</TableCell>
                            <TableCell>{tenant.telephone || "-"}</TableCell>
                            <TableCell>
                              <Link href={`/admin/people/tenants/${tenant.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Voir
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
            </TabsContent>

            <TabsContent value="vendors" className="mt-6">
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Aucun prestataire trouvé
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredVendors.map((vendor: any) => (
                          <TableRow key={vendor.id}>
                            <TableCell className="font-medium">{vendor.prenom} {vendor.nom}</TableCell>
                            <TableCell>{vendor.user?.email || "-"}</TableCell>
                            <TableCell>{vendor.telephone || "-"}</TableCell>
                            <TableCell>
                              <Link href={`/admin/people/vendors/${vendor.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Voir
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

