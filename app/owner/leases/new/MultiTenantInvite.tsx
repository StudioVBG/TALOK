"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  User,
  Users,
  Plus,
  X,
  Crown,
  UserPlus,
  Shield,
  Check,
  AlertCircle,
  Bed,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ColocationConfigData } from "./ColocationConfig";

// Types
export interface Invitee {
  tempId: string;
  role: "principal" | "colocataire";
  email: string;
  name: string;
  roomLabel?: string;
  weight?: number;
  hasGuarantor: boolean;
  guarantorEmail?: string;
  guarantorName?: string;
}

interface Room {
  id: string;
  label: string;
  surface?: number;
}

interface MultiTenantInviteProps {
  config: ColocationConfigData;
  invitees: Invitee[];
  onInviteesChange: (invitees: Invitee[]) => void;
  rooms?: Room[];
  totalRent: number;
}

// Générer un ID temporaire
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Créer un invité vide
const createEmptyInvitee = (role: "principal" | "colocataire"): Invitee => ({
  tempId: generateTempId(),
  role,
  email: "",
  name: "",
  weight: undefined,
  hasGuarantor: false,
});

export function MultiTenantInvite({
  config,
  invitees,
  onInviteesChange,
  rooms = [],
  totalRent,
}: MultiTenantInviteProps) {
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});

  // Nombre de places restantes
  const filledPlaces = invitees.length;
  const remainingPlaces = config.nbPlaces - filledPlaces;

  // Calcul automatique des parts
  const calculateWeight = useCallback((invitee: Invitee): number => {
    if (config.splitMode === "custom" && invitee.weight !== undefined) {
      return invitee.weight;
    }
    // Parts égales
    const activeInvitees = invitees.filter(i => i.email.length > 0);
    if (activeInvitees.length === 0) return 1 / config.nbPlaces;
    return 1 / Math.max(activeInvitees.length, 1);
  }, [config.splitMode, config.nbPlaces, invitees]);

  // Valider email
  const validateEmail = (email: string): boolean => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Mettre à jour un invité
  const updateInvitee = (tempId: string, updates: Partial<Invitee>) => {
    const updated = invitees.map(inv => 
      inv.tempId === tempId ? { ...inv, ...updates } : inv
    );
    onInviteesChange(updated);

    // Valider email
    if (updates.email !== undefined) {
      if (!validateEmail(updates.email)) {
        setEmailErrors(prev => ({ ...prev, [tempId]: "Email invalide" }));
      } else {
        setEmailErrors(prev => {
          const { [tempId]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  // Ajouter un colocataire
  const addInvitee = () => {
    if (filledPlaces >= config.nbPlaces) return;
    const newInvitee = createEmptyInvitee(
      invitees.length === 0 ? "principal" : "colocataire"
    );
    onInviteesChange([...invitees, newInvitee]);
  };

  // Supprimer un invité
  const removeInvitee = (tempId: string) => {
    // Ne pas supprimer si c'est le seul principal
    const invitee = invitees.find(i => i.tempId === tempId);
    if (invitee?.role === "principal" && invitees.filter(i => i.role === "principal").length === 1) {
      return;
    }
    onInviteesChange(invitees.filter(inv => inv.tempId !== tempId));
  };

  // Changer le rôle
  const changeRole = (tempId: string, newRole: "principal" | "colocataire") => {
    // Si on passe en principal, retirer le rôle principal des autres
    let updated = invitees.map(inv => {
      if (inv.tempId === tempId) {
        return { ...inv, role: newRole };
      }
      if (newRole === "principal" && inv.role === "principal") {
        return { ...inv, role: "colocataire" as const };
      }
      return inv;
    });
    onInviteesChange(updated);
  };

  // Calculer le montant par personne
  const amountPerPerson = (weight: number): number => {
    return Math.round(totalRent * weight * 100) / 100;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            Inviter les colocataires
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {filledPlaces} / {config.nbPlaces} places remplies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={remainingPlaces > 0 ? "secondary" : "default"}
            className={cn(
              remainingPlaces > 0 
                ? "bg-amber-100 text-amber-700" 
                : "bg-emerald-100 text-emerald-700"
            )}
          >
            {remainingPlaces > 0 
              ? `${remainingPlaces} place${remainingPlaces > 1 ? "s" : ""} vacante${remainingPlaces > 1 ? "s" : ""}`
              : "Complet"
            }
          </Badge>
        </div>
      </div>

      {/* Indicateur de progression */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${(filledPlaces / config.nbPlaces) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Liste des invités */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {invitees.map((invitee, index) => (
            <motion.div
              key={invitee.tempId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "relative p-4 rounded-xl border-2 transition-all",
                invitee.role === "principal"
                  ? "border-amber-300 bg-gradient-to-r from-amber-50/50 to-orange-50/50"
                  : "border-slate-200 bg-white dark:bg-slate-900"
              )}
            >
              {/* Badge rôle */}
              <div className="absolute -top-3 left-4">
                <Badge 
                  className={cn(
                    "gap-1 shadow-sm",
                    invitee.role === "principal"
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-slate-500 text-white hover:bg-slate-600"
                  )}
                >
                  {invitee.role === "principal" ? (
                    <>
                      <Crown className="h-3 w-3" />
                      Locataire principal
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3" />
                      Colocataire {index}
                    </>
                  )}
                </Badge>
              </div>

              {/* Bouton supprimer */}
              {(invitee.role !== "principal" || invitees.filter(i => i.role === "principal").length > 1) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                  onClick={() => removeInvitee(invitee.tempId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {/* Contenu */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nom */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    Nom complet
                  </Label>
                  <Input
                    placeholder="Marie Martin"
                    value={invitee.name}
                    onChange={(e) => updateInvitee(invitee.tempId, { name: e.target.value })}
                    className="bg-white dark:bg-slate-800"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    Email
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    placeholder="marie.martin@email.com"
                    value={invitee.email}
                    onChange={(e) => updateInvitee(invitee.tempId, { email: e.target.value })}
                    className={cn(
                      "bg-white dark:bg-slate-800",
                      emailErrors[invitee.tempId] && "border-red-500"
                    )}
                  />
                  {emailErrors[invitee.tempId] && (
                    <p className="text-xs text-red-500">{emailErrors[invitee.tempId]}</p>
                  )}
                </div>

                {/* Chambre (si baux individuels ou répartition par chambre) */}
                {(config.bailType === "individuel" || config.splitMode === "by_room") && rooms.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1">
                      <Bed className="h-3 w-3 text-muted-foreground" />
                      Chambre
                    </Label>
                    <Select
                      value={invitee.roomLabel || ""}
                      onValueChange={(value) => updateInvitee(invitee.tempId, { roomLabel: value })}
                    >
                      <SelectTrigger className="bg-white dark:bg-slate-800">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map(room => (
                          <SelectItem key={room.id} value={room.label}>
                            {room.label} {room.surface && `(${room.surface}m²)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Part personnalisée */}
                {config.splitMode === "custom" && (
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1">
                      Part du loyer (%)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Le total de toutes les parts doit faire 100%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={invitee.weight !== undefined ? Math.round(invitee.weight * 100) : ""}
                        onChange={(e) => updateInvitee(invitee.tempId, { 
                          weight: (parseFloat(e.target.value) || 0) / 100 
                        })}
                        className="bg-white dark:bg-slate-800 w-24"
                      />
                      <span className="text-muted-foreground">%</span>
                      {invitee.weight !== undefined && totalRent > 0 && (
                        <Badge variant="secondary">
                          {amountPerPerson(invitee.weight).toLocaleString('fr-FR')} €/mois
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Garant */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invitee.hasGuarantor}
                      onChange={(e) => updateInvitee(invitee.tempId, { hasGuarantor: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <Shield className="h-4 w-4 text-emerald-600" />
                    Ajouter un garant
                  </Label>
                </div>

                {invitee.hasGuarantor && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nom du garant</Label>
                      <Input
                        placeholder="Jean Martin"
                        value={invitee.guarantorName || ""}
                        onChange={(e) => updateInvitee(invitee.tempId, { guarantorName: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-800 h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Email du garant</Label>
                      <Input
                        type="email"
                        placeholder="garant@email.com"
                        value={invitee.guarantorEmail || ""}
                        onChange={(e) => updateInvitee(invitee.tempId, { guarantorEmail: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-800 h-9"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Montant calculé (si répartition égale) */}
              {config.splitMode === "equal" && totalRent > 0 && invitee.email && (
                <div className="mt-3 text-right">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    Part mensuelle : {amountPerPerson(calculateWeight(invitee)).toLocaleString('fr-FR')} €
                  </Badge>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bouton ajouter */}
      {remainingPlaces > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Button
            variant="outline"
            onClick={addInvitee}
            className="w-full border-dashed border-2 hover:border-violet-300 hover:bg-violet-50/50"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Ajouter un colocataire
            <Badge variant="secondary" className="ml-2">
              {remainingPlaces} place{remainingPlaces > 1 ? "s" : ""} restante{remainingPlaces > 1 ? "s" : ""}
            </Badge>
          </Button>
        </motion.div>
      )}

      {/* Note places vacantes */}
      {remainingPlaces > 0 && invitees.some(i => i.email) && (
        <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
          <p className="text-sm text-blue-700 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Vous pourrez inviter les {remainingPlaces} colocataire{remainingPlaces > 1 ? "s" : ""} restant{remainingPlaces > 1 ? "s" : ""} plus tard 
              depuis la page de gestion du bail.
            </span>
          </p>
        </div>
      )}

      {/* Résumé */}
      {invitees.filter(i => i.email).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50"
        >
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2 text-emerald-800">
            <Check className="h-4 w-4" />
            Invitations prêtes à envoyer
          </h4>
          <div className="space-y-2">
            {invitees.filter(i => i.email).map(inv => (
              <div key={inv.tempId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {inv.role === "principal" ? (
                    <Crown className="h-4 w-4 text-amber-500" />
                  ) : (
                    <User className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="font-medium">{inv.name || inv.email}</span>
                  {inv.hasGuarantor && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      <Shield className="h-3 w-3 mr-1" />
                      Garant
                    </Badge>
                  )}
                </div>
                {totalRent > 0 && (
                  <span className="text-emerald-700 font-medium">
                    {amountPerPerson(calculateWeight(inv)).toLocaleString('fr-FR')} €/mois
                  </span>
                )}
              </div>
            ))}
            {totalRent > 0 && invitees.filter(i => i.email).length > 1 && (
              <div className="pt-2 mt-2 border-t border-emerald-200 flex justify-between text-sm font-semibold text-emerald-800">
                <span>Total</span>
                <span>{totalRent.toLocaleString('fr-FR')} €/mois</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

