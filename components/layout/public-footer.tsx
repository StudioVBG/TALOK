"use client";

/**
 * PublicFooter - Footer commun pour toutes les pages publiques
 *
 * Utilisation :
 * - Homepage (/)
 * - Pages marketing (/pricing, /fonctionnalites, /contact, etc.)
 * - Pages légales (/legal/*)
 * - Blog (/blog)
 *
 * Exclure :
 * - Dashboards (/owner, /tenant, /admin) - ont leur propre layout
 * - Pages d'auth (/auth/*) - design minimaliste
 */

import Link from "next/link";

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
      { label: "Fonctionnalités", href: "/fonctionnalites" },
      { label: "Tarifs", href: "/pricing" },
      { label: "Sécurité", href: "/securite" },
      { label: "Application mobile", href: "/fonctionnalites" },
    ],
  },
  resources: {
    title: "Ressources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
      { label: "À propos", href: "/a-propos" },
    ],
  },
  legal: {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/legal/mentions" },
      { label: "CGU", href: "/legal/cgu" },
      { label: "CGV", href: "/legal/cgv" },
      { label: "Confidentialité", href: "/legal/privacy" },
      { label: "Cookies", href: "/legal/cookies" },
    ],
  },
};

export function PublicFooter({
  variant = "dark",
  compact = false,
}: PublicFooterProps) {
  const isDark = variant === "dark";

  if (compact) {
    return (
      <footer
        className={`py-8 border-t ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center">
              <img src="/images/talok-logo-horizontal.png" alt="TALOK" className="h-8 w-auto object-contain" />
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link
                href="/pricing"
                className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}
              >
                Tarifs
              </Link>
              <Link
                href="/faq"
                className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}
              >
                FAQ
              </Link>
              <Link
                href="/legal/privacy"
                className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}
              >
                Confidentialité
              </Link>
              <Link
                href="/legal/cgu"
                className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}
              >
                CGU
              </Link>
              <Link
                href="/legal/mentions"
                className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"} transition-colors`}
              >
                Mentions légales
              </Link>
            </div>

            {/* Copyright */}
            <p
              className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              © {new Date().getFullYear()} Talok. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={`py-12 md:py-16 border-t ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center mb-4">
              <img src="/images/talok-logo-horizontal.png" alt="TALOK" className="h-10 w-auto object-contain" />
            </div>
            <p
              className={`text-sm mb-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              Le logiciel de gestion locative tout-en-un. Baux conformes,
              signatures électroniques, collecte de loyers, comptabilité.
            </p>
            <div
              className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              <a
                href="mailto:support@talok.fr"
                className={`${isDark ? "hover:text-white" : "hover:text-slate-900"} transition-colors`}
              >
                support@talok.fr
              </a>
            </div>
          </div>

          {/* Link Columns */}
          {Object.values(FOOTER_LINKS).map((section) => (
            <div key={section.title}>
              <h4
                className={`font-semibold mb-4 ${isDark ? "text-white" : "text-slate-900"}`}
              >
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
        <div
          className={`pt-8 border-t ${isDark ? "border-slate-800" : "border-slate-200"} flex flex-col md:flex-row items-center justify-between gap-4`}
        >
          <p
            className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            © {new Date().getFullYear()} Talok. Tous droits réservés. Né en
            Martinique 🇲🇶 · Pour toute la France.
          </p>
          <div className="flex items-center gap-4">
            <span
              className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}
            >
              De nombreux propriétaires nous font confiance
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
