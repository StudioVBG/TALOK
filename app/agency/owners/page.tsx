"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Users,
  Building2,
  Euro,
  Mail,
  Phone,
  MoreHorizontal,
  Eye,
  FileText,
  Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Données de démonstration
const mockOwners = [
  {
    id: "1",
    name: "Jean Dupont",
    email: "jean.dupont@email.com",
    phone: "06 12 34 56 78",
    type: "particulier",
    biensCount: 3,
    loyersTotal: 3200,
    mandatStatus: "active",
    since: "Janvier 2024",
  },
  {
    id: "2",
    name: "Marie Martin",
    email: "marie.martin@email.com",
    phone: "06 23 45 67 89",
    type: "particulier",
    biensCount: 5,
    loyersTotal: 5800,
    mandatStatus: "active",
    since: "Mars 2024",
  },
  {
    id: "3",
    name: "SCI Les Oliviers",
    email: "contact@sci-oliviers.fr",
    phone: "04 91 23 45 67",
    type: "societe",
    biensCount: 8,
    loyersTotal: 9500,
    mandatStatus: "pending",
    since: "Juin 2024",
  },
  {
    id: "4",
    name: "Pierre Lefebvre",
    email: "p.lefebvre@gmail.com",
    phone: "06 34 56 78 90",
    type: "particulier",
    biensCount: 2,
    loyersTotal: 1800,
    mandatStatus: "active",
    since: "Septembre 2024",
  },
  {
    id: "5",
    name: "Sophie Bernard",
    email: "s.bernard@outlook.com",
    phone: "06 45 67 89 01",
    type: "particulier",
    biensCount: 1,
    loyersTotal: 950,
    mandatStatus: "draft",
    since: "Novembre 2024",
  },
];

export default function OwnersPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOwners = mockOwners.filter((owner) =>
    owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    owner.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBiens = mockOwners.reduce((sum, o) => sum + o.biensCount, 0);
  const totalLoyers = mockOwners.reduce((sum, o) => sum + o.loyersTotal, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Propriétaires mandants
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos relations avec les propriétaires
          </p>
        </div>
        <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" asChild>
          <Link href="/agency/owners/invite">
            <Plus className="w-4 h-4 mr-2" />
            Inviter un propriétaire
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockOwners.length}</p>
              <p className="text-sm text-muted-foreground">Propriétaires</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalBiens}</p>
              <p className="text-sm text-muted-foreground">Biens gérés</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Euro className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalLoyers.toLocaleString("fr-FR")}€</p>
              <p className="text-sm text-muted-foreground">Loyers mensuels</p>
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
              placeholder="Rechercher un propriétaire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Owners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOwners.map((owner) => (
          <motion.div
            key={owner.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-indigo-200">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold">
                        {owner.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{owner.name}</h3>
                      <Badge variant="outline" className={cn(
                        "text-xs mt-1",
                        owner.type === "societe" 
                          ? "border-purple-500 text-purple-600" 
                          : "border-slate-400 text-slate-600"
                      )}>
                        {owner.type === "societe" ? "Société" : "Particulier"}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="w-4 h-4 mr-2" />
                        Voir le profil
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <FileText className="w-4 h-4 mr-2" />
                        Voir le mandat
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Send className="w-4 h-4 mr-2" />
                        Envoyer un message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{owner.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{owner.phone}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-indigo-600">{owner.biensCount}</p>
                    <p className="text-xs text-muted-foreground">Biens</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{owner.loyersTotal.toLocaleString("fr-FR")}€</p>
                    <p className="text-xs text-muted-foreground">Loyers/mois</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Client depuis {owner.since}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      owner.mandatStatus === "active" && "border-emerald-500 text-emerald-600 bg-emerald-50",
                      owner.mandatStatus === "pending" && "border-amber-500 text-amber-600 bg-amber-50",
                      owner.mandatStatus === "draft" && "border-slate-400 text-slate-600 bg-slate-50"
                    )}
                  >
                    {owner.mandatStatus === "active" ? "Mandat actif" : 
                     owner.mandatStatus === "pending" ? "En attente" : "Brouillon"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredOwners.length === 0 && (
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucun propriétaire trouvé</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

