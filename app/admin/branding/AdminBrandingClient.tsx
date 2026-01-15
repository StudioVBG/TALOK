"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Search,
  Plus,
  Settings,
  Globe,
  Users,
  ChevronRight,
  Palette,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BrandingForm } from "@/components/white-label/branding-form";
import { FeatureList } from "@/components/white-label/feature-gate";
import {
  WhiteLabelLevel,
  WHITE_LABEL_LEVEL_INFO,
  Organization,
  OrganizationBranding,
} from "@/lib/white-label/types";

interface AdminBrandingClientProps {
  organizations: any[];
}

export function AdminBrandingClient({ organizations }: AdminBrandingClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("list");

  // Filtrer les organisations
  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const stats = {
    total: organizations.length,
    basic: organizations.filter((o) => o.white_label_level === "basic").length,
    full: organizations.filter((o) => o.white_label_level === "full").length,
    premium: organizations.filter((o) => o.white_label_level === "premium").length,
    withDomain: organizations.filter(
      (o) => o.domains?.some((d: any) => d.verified)
    ).length,
  };

  const getLevelBadgeClass = (level: WhiteLabelLevel) => {
    switch (level) {
      case "premium":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "full":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "basic":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-500 border-slate-200";
    }
  };

  const handleSaveBranding = async (updates: Partial<OrganizationBranding>) => {
    // En production: appel API pour sauvegarder
    console.log("Save branding:", updates);
    // Simuler un délai
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleUploadAsset = async (type: string, file: File) => {
    // En production: upload vers Supabase Storage
    console.log("Upload asset:", type, file.name);
    // Simuler un délai et retourner une URL fictive
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return URL.createObjectURL(file);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Gestion White-Label
          </h1>
          <p className="text-sm text-slate-500">
            Administrez les configurations de marque blanche
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-slate-500">Organisations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Palette className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.basic}</p>
                <p className="text-xs text-slate-500">Basic</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Palette className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.full}</p>
                <p className="text-xs text-slate-500">Full</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                <Palette className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.premium}</p>
                <p className="text-xs text-slate-500">Premium</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Globe className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.withDomain}</p>
                <p className="text-xs text-slate-500">Avec domaine</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">
            <Building2 className="w-4 h-4 mr-2" />
            Organisations
          </TabsTrigger>
          <TabsTrigger value="domains">
            <Globe className="w-4 h-4 mr-2" />
            Domaines
          </TabsTrigger>
          <TabsTrigger value="features">
            <Settings className="w-4 h-4 mr-2" />
            Features par niveau
          </TabsTrigger>
        </TabsList>

        {/* Liste des organisations */}
        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Organisations</CardTitle>
                  <CardDescription>
                    Liste des organisations avec white-label configuré
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredOrgs.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">
                    Aucune organisation
                  </h3>
                  <p className="text-sm text-slate-500">
                    Les organisations avec white-label apparaîtront ici
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organisation</TableHead>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Domaine</TableHead>
                      <TableHead>Propriétaire</TableHead>
                      <TableHead>Branding</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrgs.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {org.branding?.logo_url ? (
                              <img
                                src={org.branding.logo_url}
                                alt={org.name}
                                className="w-8 h-8 rounded object-contain bg-slate-100"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{org.name}</p>
                              <p className="text-xs text-slate-500">{org.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getLevelBadgeClass(org.white_label_level)}
                          >
                            {WHITE_LABEL_LEVEL_INFO[org.white_label_level as WhiteLabelLevel]?.label || "Aucun"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {org.domains?.find((d: any) => d.verified) ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-sm">
                                {org.domains.find((d: any) => d.is_primary)?.domain || org.domains[0].domain}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {org.owner?.full_name || org.owner?.email || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {org.branding?.primary_color && (
                              <div
                                className="w-4 h-4 rounded border border-slate-200"
                                style={{ backgroundColor: org.branding.primary_color }}
                                title={`Couleur: ${org.branding.primary_color}`}
                              />
                            )}
                            {org.branding?.company_name && (
                              <span className="text-xs text-slate-500 truncate max-w-[100px]">
                                {org.branding.company_name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedOrg(org)}
                              >
                                <Settings className="w-4 h-4 mr-1" />
                                Configurer
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  Configuration - {org.name}
                                </DialogTitle>
                                <DialogDescription>
                                  Modifier le branding de l'organisation
                                </DialogDescription>
                              </DialogHeader>
                              <BrandingForm
                                branding={org.branding || {}}
                                level={org.white_label_level as WhiteLabelLevel}
                                organizationId={org.id}
                                onSave={handleSaveBranding}
                                onUploadAsset={handleUploadAsset}
                              />
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domaines */}
        <TabsContent value="domains" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Domaines personnalisés</CardTitle>
              <CardDescription>
                Vue d'ensemble de tous les domaines configurés
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domaine</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>SSL</TableHead>
                    <TableHead>Primaire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations
                    .flatMap((org) =>
                      (org.domains || []).map((domain: any) => ({
                        ...domain,
                        orgName: org.name,
                      }))
                    )
                    .map((domain: any) => (
                      <TableRow key={domain.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-slate-400" />
                            <span className="font-mono text-sm">{domain.domain}</span>
                            <a
                              href={`https://${domain.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>{domain.orgName}</TableCell>
                        <TableCell>
                          {domain.verified ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Vérifié
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="w-3 h-3 mr-1" />
                              En attente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              domain.ssl_status === "active"
                                ? "border-green-500 text-green-600"
                                : "border-amber-500 text-amber-600"
                            }
                          >
                            {domain.ssl_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {domain.is_primary && (
                            <Badge variant="outline">Principal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>

              {organizations.every((org) => !org.domains?.length) && (
                <div className="text-center py-12">
                  <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Aucun domaine configuré</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features par niveau */}
        <TabsContent value="features" className="mt-6">
          <div className="grid md:grid-cols-3 gap-6">
            {(["basic", "full", "premium"] as WhiteLabelLevel[]).map((level) => {
              const info = WHITE_LABEL_LEVEL_INFO[level];
              return (
                <Card key={level}>
                  <CardHeader>
                    <Badge
                      variant="outline"
                      className={cn("w-fit mb-2", getLevelBadgeClass(level))}
                    >
                      {info.label}
                    </Badge>
                    <CardTitle className="text-lg">{info.plan}</CardTitle>
                    <CardDescription>{info.price}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FeatureList currentLevel={level} showAll={false} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
