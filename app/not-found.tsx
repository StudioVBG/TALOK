"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="text-center max-w-md">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="relative">
            <span className="text-[12rem] font-bold text-slate-200 dark:text-slate-800 leading-none">
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="h-24 w-24 text-slate-400 dark:text-slate-600" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Page introuvable
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Désolé, la page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="default">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Accueil
            </Link>
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>

        {/* Help */}
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-500">
          Besoin d&apos;aide ?{" "}
          <Link href="/app/owner/support" className="text-primary hover:underline">
            Contactez le support
          </Link>
        </p>
      </div>
    </div>
  );
}
