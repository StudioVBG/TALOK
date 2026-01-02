"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Users,
  Mail,
  Phone,
  Home,
  Euro,
  CheckCircle,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Données de démonstration
const mockTenants = [
  {
    id: "1",
    name: "Sophie Bernard",
    email: "sophie.bernard@email.com",
    phone: "06 22 33 44 55",
    property: "15 Rue Victor Hugo, Paris",
    owner: "Jean Dupont",
    loyer: 1450,
    paymentStatus: "paid",
    since: "Mars 2024",
  },
  {
    id: "2",
    name: "Lucas Petit",
    email: "lucas.petit@email.com",
    phone: "06 33 44 55 66",
    property: "8 Avenue de la République, Lyon",
    owner: "Marie Martin",
    loyer: 650,
    paymentStatus: "paid",
    since: "Juin 2024",
  },
  {
    id: "3",
    name: "Emma Durand",
    email: "emma.durand@email.com",
    phone: "06 44 55 66 77",
    property: "42 Boulevard Gambetta, Marseille",
    owner: "SCI Les Oliviers",
    loyer: 1100,
    paymentStatus: "late",
    since: "Janvier 2024",
  },
  {
    id: "4",
    name: "Marc Dubois",
    email: "marc.dubois@email.com",
    phone: "06 55 66 77 88",
    property: "27 Place du Marché, Toulouse",
    owner: "Marie Martin",
    loyer: 750,
    paymentStatus: "paid",
    since: "Septembre 2024",
  },
  {
    id: "5",
    name: "Claire Moreau",
    email: "claire.moreau@email.com",
    phone: "06 66 77 88 99",
    property: "5 Rue des Jardins, Nantes",
    owner: "SCI Les Oliviers",
    loyer: 890,
    paymentStatus: "pending",
    since: "Novembre 2024",
  },
];

export default function AgencyTenantsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTenants = mockTenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.property.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: mockTenants.length,
    upToDate: mockTenants.filter((t) => t.paymentStatus === "paid").length,
    late: mockTenants.filter((t) => t.paymentStatus === "late").length,
    totalLoyers: mockTenants.reduce((sum, t) => sum + t.loyer, 0),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Locataires
        </h1>
        <p className="text-muted-foreground mt-1">
          Tous les locataires des biens sous gestion
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Locataires</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.upToDate}</p>
              <p className="text-xs text-muted-foreground">À jour</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.late}</p>
              <p className="text-xs text-muted-foreground">En retard</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Euro className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalLoyers.toLocaleString("fr-FR")}€</p>
              <p className="text-xs text-muted-foreground">Loyers/mois</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un locataire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tenants List */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Locataire</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Bien</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Propriétaire</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Loyer</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Statut paiement</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold">
                            {tenant.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {tenant.email}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{tenant.property}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm">{tenant.owner}</td>
                    <td className="py-4 px-4 text-right font-semibold">{tenant.loyer}€</td>
                    <td className="py-4 px-4 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          tenant.paymentStatus === "paid" && "border-emerald-500 text-emerald-600 bg-emerald-50",
                          tenant.paymentStatus === "pending" && "border-amber-500 text-amber-600 bg-amber-50",
                          tenant.paymentStatus === "late" && "border-red-500 text-red-600 bg-red-50"
                        )}
                      >
                        {tenant.paymentStatus === "paid" && "À jour"}
                        {tenant.paymentStatus === "pending" && "En attente"}
                        {tenant.paymentStatus === "late" && "En retard"}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            Voir le profil
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Send className="w-4 h-4 mr-2" />
                            Envoyer un message
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

