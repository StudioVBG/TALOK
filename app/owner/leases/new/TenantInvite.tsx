"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  User,
  Shield,
  Info,
  FileSignature
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface TenantInviteProps {
  tenantEmail: string;
  tenantName: string;
  onEmailChange: (email: string) => void;
  onNameChange: (name: string) => void;
  mode: "invite" | "manual";
  onModeChange: (mode: "invite" | "manual") => void;
}

import { Upload } from "lucide-react";

export function TenantInvite({
  tenantEmail,
  tenantName,
  onEmailChange,
  onNameChange,
  mode,
  onModeChange
}: TenantInviteProps) {
  const [emailError, setEmailError] = useState("");

  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError("");
      return;
    }
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setEmailError(isValid ? "" : "Email invalide");
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    onEmailChange(email);
    validateEmail(email);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Finalisation du bail</h3>
        {mode === "invite" && (
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            Signature sécurisée
          </Badge>
        )}
      </div>

      <Tabs value={mode} onValueChange={(v) => onModeChange(v as "invite" | "manual")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="invite" className="gap-2">
            <Mail className="h-4 w-4" />
            Nouveau locataire
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Upload className="h-4 w-4" />
            Locataire déjà en place
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invite" className="space-y-6">
          {/* Formulaire Invitation */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tenant_name" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Nom du locataire
                  <Badge variant="outline" className="text-[10px]">Optionnel</Badge>
                </Label>
                <Input
                  id="tenant_name"
                  type="text"
                  placeholder="Marie Martin"
                  value={tenantName}
                  onChange={(e) => onNameChange(e.target.value)}
                  className="bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant_email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email du locataire
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="tenant_email"
                  type="email"
                  placeholder="marie.martin@email.com"
                  value={tenantEmail}
                  onChange={handleEmailChange}
                  className={cn(
                    "bg-white dark:bg-slate-900",
                    emailError && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {emailError && (
                  <p className="text-xs text-red-500">{emailError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Info Box Invitation */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg shrink-0">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-2 flex-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                  Parcours 100% numérique
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Le locataire recevra un lien sécurisé pour vérifier son identité et signer électroniquement le bail.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Vérification d'identité — compact */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
            <Shield className="h-4 w-4 text-green-600 shrink-0" />
            <span>Vérification d'identité incluse (CNI/passeport ou France Identité)</span>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tenant_name_manual" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Nom du locataire (Optionnel)
                </Label>
                <Input
                  id="tenant_name_manual"
                  type="text"
                  placeholder="Laisser vide pour un bail vierge"
                  value={tenantName}
                  onChange={(e) => onNameChange(e.target.value)}
                  className="bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg shrink-0">
                <FileSignature className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-amber-900 dark:text-amber-100">
                  Mode hors-ligne
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Un bail sera généré et enregistré dans Talok pour le suivi (loyers, quittances, EDL),
                  mais la signature se fera en dehors de la plateforme.
                </p>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
