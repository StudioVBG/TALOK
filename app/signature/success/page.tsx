"use client";
// @ts-nocheck

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Download,
  Home,
  Mail,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignatureSuccessPage() {
  const searchParams = useSearchParams();
  const leaseId = searchParams.get("lease_id");

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/50 to-teal-50 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full"
      >
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
          {/* Header avec animation */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 text-center relative overflow-hidden">
            {/* Particules décoratives */}
            <div className="absolute inset-0">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-white/20 rounded-full"
                  style={{
                    left: `${20 + i * 15}%`,
                    top: `${20 + (i % 3) * 25}%`,
                  }}
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0.2, 0.5, 0.2],
                  }}
                  transition={{
                    duration: 2 + i * 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            {/* Icône de succès */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="relative z-10"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative z-10"
            >
              <h1 className="text-2xl font-bold text-white mb-2">
                🎉 Bail signé avec succès !
              </h1>
              <p className="text-green-100">
                Votre signature a été enregistrée
              </p>
            </motion.div>
          </div>

          {/* Contenu */}
          <div className="p-6 space-y-6">
            {/* Prochaines étapes */}
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Prochaines étapes
              </h2>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      Signature du propriétaire
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Le propriétaire va maintenant signer le bail à son tour
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                    <Mail className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      Réception du bail signé
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Vous recevrez le document final par email
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                    <Home className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      Accès à votre espace locataire
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Créez votre compte pour gérer votre location
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t">
              <Button className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600" asChild>
                <Link href="/auth/signup?role=tenant">
                  <Home className="h-4 w-4" />
                  Créer mon espace locataire
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button variant="outline" className="w-full gap-2">
                <Download className="h-4 w-4" />
                Télécharger mon récépissé
              </Button>
            </div>

            {/* Info */}
            <p className="text-center text-xs text-muted-foreground">
              Un email de confirmation a été envoyé à votre adresse.
              <br />
              Conservez ce lien pour retrouver votre bail.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

