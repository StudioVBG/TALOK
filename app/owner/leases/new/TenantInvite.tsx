"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  User,
  Shield,
  Info,
  CreditCard,
  Fingerprint,
  PenTool,
  Printer,
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
            Inviter par email
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <PenTool className="h-4 w-4" />
            Bail vierge / Manuscrit
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

          {/* Options de vérification d'identité */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              Vérification d'identité incluse
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                  <CreditCard className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Scan CNI / Passeport</p>
                  <p className="text-xs text-muted-foreground">Photo recto de la pièce</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <Fingerprint className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">France Identité</p>
                  <p className="text-xs text-muted-foreground">App officielle + NFC</p>
                </div>
              </div>
            </div>
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
              <div className="space-y-3 flex-1">
                <div>
                  <h4 className="font-medium text-amber-900 dark:text-amber-100">
                    Bail pré-rempli à imprimer
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Ce mode génère un PDF avec les informations du bien et du propriétaire déjà remplies. Les champs locataire seront laissés vides (ou pré-remplis si vous avez mis un nom) pour être complétés à la main.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                    <Printer className="h-4 w-4" />
                    Idéal pour signature papier
                  </div>
                  <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                    <PenTool className="h-4 w-4" />
                    Signature sur place
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
