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
  CreditCard,
  ClipboardCheck,
  Receipt,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SignatureSuccessPage() {
  const searchParams = useSearchParams();
  const leaseId = searchParams.get("lease_id");
  const allSigned = searchParams.get("all_signed") === "true";

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
                {allSigned
                  ? "🎉 Bail entièrement signé !"
                  : "🎉 Bail signé avec succès !"}
              </h1>
              <p className="text-green-100">
                {allSigned
                  ? "Toutes les signatures sont enregistrées"
                  : "Votre signature a été enregistrée"}
              </p>
            </motion.div>
          </div>

          {/* Contenu */}
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                {allSigned ? "Votre bail est actif" : "Prochaines étapes"}
              </h2>

              {allSigned ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                      <Receipt className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        Facture initiale disponible
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Votre premier versement (loyer + dépôt de garantie) est prêt à être réglé.
                        Vous recevrez un email avec le détail.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        Configurez votre moyen de paiement
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Carte bancaire ou prélèvement SEPA, payez en toute sécurité via Stripe.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                      <ClipboardCheck className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        État des lieux d'entrée
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Votre propriétaire programmera l'état des lieux pour finaliser votre emménagement.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
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
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t">
              {allSigned ? (
                <>
                  <Link
                    href="/tenant/payments"
                    className={cn(buttonVariants({ variant: "default" }), "w-full gap-2 bg-gradient-to-r from-emerald-600 to-green-600")}
                  >
                    <CreditCard className="h-4 w-4" />
                    Régler ma facture initiale
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/auth/signup?role=tenant"
                    className={cn(buttonVariants({ variant: "outline" }), "w-full gap-2")}
                  >
                    <Home className="h-4 w-4" />
                    Créer mon espace locataire
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/signup?role=tenant"
                    className={cn(buttonVariants({ variant: "default" }), "w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600")}
                  >
                    <Home className="h-4 w-4" />
                    Créer mon espace locataire
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Button variant="outline" className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Télécharger mon récépissé
                  </Button>
                </>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {allSigned
                ? "Un email avec le détail de votre facture initiale vous sera envoyé sous peu."
                : "Un email de confirmation a été envoyé à votre adresse."}
              <br />
              Conservez ce lien pour retrouver votre bail.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

