"use client";

/**
 * PublicFooter - Footer commun pour toutes les pages publiques
 *
 * Utilisation :
 * - Homepage (/)
 * - Pages marketing (/pricing, /fonctionnalites, /contact, etc.)
 * - Pages légales (/legal/terms, /legal/privacy)
 * - Blog (/blog)
 *
 * Exclure :
 * - Dashboards (/owner, /tenant, /admin) - ont leur propre layout
 * - Pages d'auth (/auth/*) - design minimaliste
 */

import Link from "next/link";
import { Building2 } from "lucide-react";

interface PublicFooterProps {
  /** Variante de style (dark pour homepage, light pour autres pages) */
  variant?: "dark" | "light";
  /** Afficher la version compacte */
  compact?: boolean;
}

const FOOTER_LINKS = {
  product: {
    title: "Produit",
    links: [
      { label: "Fonctionnalites", href: "/fonctionnalites" },
      { label: "Tarifs", href: "/pricing" },
      { label: "Solutions", href: "/solutions/proprietaires-particuliers" },
      { label: "Temoignages", href: "/temoignages" },
    ],
  },
  resources: {
    title: "Ressources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Guides", href: "/guides" },
      { label: "FAQ", href: "/faq" },
      { label: "Outils", href: "/outils/calcul-rendement-locatif" },
    ],
  },
  legal: {
    title: "Legal",
    links: [
      { label: "CGU", href: "/legal/terms" },
      { label: "Confidentialite", href: "/legal/privacy" },
      { label: "Contact", href: "/contact" },
    ],
  },
};

export function PublicFooter({ variant = "dark", compact = false }: PublicFooterProps) {
  const isDark = variant === "dark";

  if (compact) {
    return (
      <footer className={`py-8 border-t ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? "bg-gradient-to-br from-indigo-500 to-cyan-500" : "bg-primary"}`}>
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Talok</span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link href="/pricing" className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}>
                Tarifs
              </Link>
              <Link href="/fonctionnalites" className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}>
                Fonctionnalites
              </Link>
              <Link href="/blog" className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}>
                Blog
              </Link>
              <Link href="/legal/privacy" className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}>
                Confidentialite
              </Link>
              <Link href="/legal/terms" className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}>
                CGU
              </Link>
            </div>

            {/* Copyright */}
            <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              2026 Talok. Tous droits reserves.
            </p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`py-12 md:py-16 border-t ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? "bg-gradient-to-br from-indigo-500 to-cyan-500" : "bg-primary"}`}>
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Talok</span>
            </div>
            <p className={`text-sm mb-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Le logiciel de gestion locative n1 en France. Baux ALUR, e-signatures, scoring IA.
            </p>
            <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              <a href="mailto:support@talok.fr" className={`${isDark ? "hover:text-white" : "hover:text-slate-900"} transition-colors`}>
                support@talok.fr
              </a>
            </div>
          </div>

          {/* Link Columns */}
          {Object.values(FOOTER_LINKS).map((section) => (
            <div key={section.title}>
              <h4 className={`font-semibold mb-4 ${isDark ? "text-white" : "text-slate-900"}`}>
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`text-sm ${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className={`pt-8 border-t ${isDark ? "border-slate-800" : "border-slate-200"} flex flex-col md:flex-row items-center justify-between gap-4`}>
          <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            2026 Talok. Tous droits reserves. Fait avec passion en France.
          </p>
          <div className="flex items-center gap-4">
            <span className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
              +10 000 proprietaires nous font confiance
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
