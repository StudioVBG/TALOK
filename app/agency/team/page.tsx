"use client";

/**
 * TeamPage - Gestion de l'équipe agence
 * SOTA 2026: Feature multi_users requiert Confort+
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  Shield,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
} from "lucide-react";
import { PlanGate } from "@/components/subscription";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Données de démonstration
const mockTeamMembers = [
  {
    id: "1",
    name: "Marie Dupont",
    email: "marie.dupont@agence.fr",
    phone: "06 01 02 03 04",
    role: "directeur",
    propertiesCount: 47,
    status: "active",
    since: "Janvier 2020",
  },
  {
    id: "2",
    name: "Thomas Martin",
    email: "thomas.martin@agence.fr",
    phone: "06 11 22 33 44",
    role: "gestionnaire",
    propertiesCount: 18,
    status: "active",
    since: "Mars 2022",
  },
  {
    id: "3",
    name: "Julie Bernard",
    email: "julie.bernard@agence.fr",
    phone: "06 22 33 44 55",
    role: "gestionnaire",
    propertiesCount: 15,
    status: "active",
    since: "Septembre 2023",
  },
  {
    id: "4",
    name: "Lucas Petit",
    email: "lucas.petit@agence.fr",
    phone: "06 33 44 55 66",
    role: "assistant",
    propertiesCount: 0,
    status: "active",
    since: "Juin 2024",
  },
  {
    id: "5",
    name: "Emma Leroy",
    email: "emma.leroy@agence.fr",
    phone: "06 44 55 66 77",
    role: "comptable",
    propertiesCount: 0,
    status: "active",
    since: "Novembre 2024",
  },
];

const roleConfig = {
  directeur: { label: "Directeur", color: "bg-purple-100 text-purple-700 border-purple-300" },
  gestionnaire: { label: "Gestionnaire", color: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  assistant: { label: "Assistant", color: "bg-sky-100 text-sky-700 border-sky-300" },
  comptable: { label: "Comptable", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
};

export default function TeamPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const filteredMembers = mockTeamMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PlanGate feature="multi_users" mode="blur">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Équipe
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les membres de votre agence
          </p>
        </div>
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
              <UserPlus className="w-4 h-4 mr-2" />
              Inviter un collaborateur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter un collaborateur</DialogTitle>
              <DialogDescription>
                Envoyez une invitation par email pour rejoindre votre agence
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" placeholder="collaborateur@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Rôle</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="comptable">Comptable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => setIsInviteDialogOpen(false)}>
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockTeamMembers.length}</p>
              <p className="text-sm text-muted-foreground">Membres</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockTeamMembers.filter((m) => m.role === "gestionnaire").length}</p>
              <p className="text-sm text-muted-foreground">Gestionnaires</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockTeamMembers.filter((m) => m.status === "active").length}</p>
              <p className="text-sm text-muted-foreground">Actifs</p>
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
              placeholder="Rechercher un membre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map((member) => {
          const role = roleConfig[member.role as keyof typeof roleConfig];
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12 border-2 border-indigo-200">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold">
                          {member.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{member.name}</h3>
                        <Badge variant="outline" className={cn("text-xs", role.color)}>
                          {role.label}
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
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Retirer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{member.phone}</span>
                    </div>
                  </div>

                  {member.propertiesCount > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Biens assignés :</span>{" "}
                        <span className="font-semibold text-indigo-600">{member.propertiesCount}</span>
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t">
                    <span className="text-xs text-muted-foreground">Membre depuis {member.since}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
    </PlanGate>
  );
}

