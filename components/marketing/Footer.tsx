"use client"

import Link from "next/link"

const columns = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/fonctionnalites" },
      { label: "Tarifs", href: "/pricing" },
      { label: "Nouveautés", href: "/blog" },
      { label: "App mobile", href: "/fonctionnalites" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Propriétaires", href: "/solutions/proprietaires-particuliers" },
      { label: "Investisseurs", href: "/solutions/investisseurs" },
      { label: "Agences", href: "/solutions/administrateurs-biens" },
      { label: "France d\u2019outre-mer", href: "/solutions/dom-tom" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Guides", href: "/guides" },
      { label: "FAQ", href: "/faq" },
      { label: "Témoignages", href: "/temoignages" },
      { label: "Outils gratuits", href: "/outils/calcul-rendement-locatif" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "CGU", href: "/legal/terms" },
      { label: "CGV", href: "/legal/cgv" },
      { label: "Confidentialité", href: "/legal/privacy" },
      { label: "Mentions légales", href: "/legal/mentions" },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-800 bg-[#0F172A]">
      <div className="mx-auto max-w-[1100px] px-4 py-12 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <img src="/images/talok-icon.png" alt="TALOK" className="h-8 w-8 rounded-lg object-contain" />
              <span className="text-lg font-bold text-white font-display">TALOK</span>
            </Link>
            <p className="text-sm leading-relaxed text-slate-400">
              LE Logiciel de Gestion Locative
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          <p>
            © 2026 Talok · Né en Martinique 🇲🇶
          </p>
          <p className="mt-1">
            Données hébergées en France ·{" "}
            <a href="mailto:support@talok.fr" className="hover:text-slate-300 transition-colors">
              support@talok.fr
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
