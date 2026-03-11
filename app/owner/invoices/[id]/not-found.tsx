"use client";

import { ArrowLeft, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
      <span className="text-5xl font-bold text-slate-300">404</span>
      <h2 className="text-xl font-semibold text-slate-900">Facture introuvable</h2>
      <p className="text-sm text-slate-500 text-center max-w-md">
        Cet élément n'existe pas ou vous n'avez pas les droits pour y accéder.
      </p>
      <div className="flex gap-3 mt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/owner/money">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/owner/dashboard">
            <HomeIcon className="mr-2 h-4 w-4" />
            Tableau de bord
          </Link>
        </Button>
      </div>
    </div>
  );
}
