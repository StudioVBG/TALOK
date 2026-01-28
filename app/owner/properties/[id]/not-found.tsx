"use client";

import { motion } from "framer-motion";
import { Home as HomeIcon, Search, ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function PropertyNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="border-slate-200/50 shadow-lg">
          <CardHeader className="text-center pb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="mx-auto mb-4 w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center"
            >
              <Building2 className="h-10 w-10 text-slate-400" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <span className="text-6xl font-bold bg-gradient-to-r from-slate-300 to-slate-400 bg-clip-text text-transparent">
                404
              </span>
            </motion.div>
            <CardTitle className="text-2xl text-slate-900 mt-4">
              Bien introuvable
            </CardTitle>
            <CardDescription className="text-slate-600">
              Ce bien immobilier n'existe pas ou vous n'avez pas les droits pour y accéder
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Possible Reasons */}
            <div className="text-sm text-slate-600 space-y-2">
              <p>Cela peut arriver si :</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                <li>Le bien a été supprimé</li>
                <li>L'URL est incorrecte ou obsolète</li>
                <li>Vous n'êtes pas le propriétaire de ce bien</li>
                <li>Le bien a été transféré à un autre compte</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Link href="/owner/properties">
                  <Search className="mr-2 h-4 w-4" />
                  Voir mes biens
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="flex-1"
              >
                <Link href="/owner">
                  <HomeIcon className="mr-2 h-4 w-4" />
                  Tableau de bord
                </Link>
              </Button>
            </div>

            {/* Back Link */}
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.history.back()}
                className="text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la page précédente
              </Button>
            </div>

            {/* Help */}
            <p className="text-center text-xs text-slate-500">
              Besoin d'aide ?{" "}
              <Link
                href="/support"
                className="text-blue-600 hover:underline"
              >
                Contactez le support
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
