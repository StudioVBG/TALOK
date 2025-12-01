"use client";
// @ts-nocheck

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  User,
  Smartphone,
  Shield,
  FileText,
  CheckCircle,
  Info,
  Send,
  CreditCard,
  Fingerprint,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TenantInviteProps {
  tenantEmail: string;
  tenantName: string;
  onEmailChange: (email: string) => void;
  onNameChange: (name: string) => void;
}

export function TenantInvite({
  tenantEmail,
  tenantName,
  onEmailChange,
  onNameChange,
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
        <h3 className="text-lg font-semibold">Invitez le locataire</h3>
        <Badge variant="secondary" className="gap-1">
          <Shield className="h-3 w-3" />
          Signature sécurisée
        </Badge>
      </div>

      {/* Formulaire */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nom (optionnel) */}
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

          {/* Email (requis) */}
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

      {/* Ce que le locataire va recevoir */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg shrink-0">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-3 flex-1">
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Le locataire recevra un email pour :
              </h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Étape 1 */}
              <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                <div className="p-1.5 bg-blue-500 rounded-full text-white shrink-0">
                  <span className="text-xs font-bold w-4 h-4 flex items-center justify-center">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Vérifier son identité
                  </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                    CNI ou France Identité
                  </p>
                </div>
              </div>

              {/* Étape 2 */}
              <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                <div className="p-1.5 bg-blue-500 rounded-full text-white shrink-0">
                  <span className="text-xs font-bold w-4 h-4 flex items-center justify-center">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Relire le bail
                  </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                    Aperçu complet du contrat
                  </p>
                </div>
              </div>

              {/* Étape 3 */}
              <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                <div className="p-1.5 bg-blue-500 rounded-full text-white shrink-0">
                  <span className="text-xs font-bold w-4 h-4 flex items-center justify-center">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Signer le bail
                  </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                    Signature électronique
                  </p>
                </div>
              </div>
            </div>
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

      {/* Avantages */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Smartphone, text: "Mobile-friendly" },
          { icon: Shield, text: "Sécurisé" },
          { icon: FileText, text: "Légal" },
          { icon: CheckCircle, text: "Valeur probante" },
        ].map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

