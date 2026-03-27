"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText, CreditCard, ClipboardCheck, FolderOpen, Wrench, PieChart,
  Building2, Briefcase, Building, MapPin, Home,
  ChevronDown, Menu, X,
} from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"

const produitLinks = [
  { label: "Gestion des baux", href: "/fonctionnalites#baux", icon: FileText },
  { label: "Paiements en ligne", href: "/fonctionnalites#paiements", icon: CreditCard },
  { label: "Etats des lieux", href: "/fonctionnalites#edl", icon: ClipboardCheck },
  { label: "Documents", href: "/fonctionnalites#documents", icon: FolderOpen },
  { label: "Tickets & travaux", href: "/fonctionnalites#tickets", icon: Wrench },
  { label: "Comptabilite", href: "/fonctionnalites#comptabilite", icon: PieChart },
]

const solutionsLinks = [
  { label: "Proprietaires", href: "/solutions/proprietaires-particuliers", icon: Building2 },
  { label: "Investisseurs", href: "/solutions/investisseurs", icon: Briefcase },
  { label: "Agences", href: "/solutions/administrateurs-biens", icon: Building },
  { label: "France d\u2019outre-mer", href: "/solutions/dom-tom", icon: MapPin },
]

export function MarketingNavbar() {
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 21V9l9-7 9 7v12a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z" fill="white" />
            </svg>
          </div>
          <span className="text-lg font-bold text-[#1B2A6B] font-display">TALOK</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 lg:flex">
          <NavDropdown
            label="Produit"
            links={produitLinks}
            open={openDropdown === "produit"}
            onToggle={() => setOpenDropdown(openDropdown === "produit" ? null : "produit")}
            onClose={() => setOpenDropdown(null)}
          />
          <NavDropdown
            label="Solutions"
            links={solutionsLinks}
            open={openDropdown === "solutions"}
            onToggle={() => setOpenDropdown(openDropdown === "solutions" ? null : "solutions")}
            onClose={() => setOpenDropdown(null)}
          />
          <NavLink href="/pricing">Tarifs</NavLink>
          <NavLink href="/blog">Blog</NavLink>
          <NavLink href="/faq">FAQ</NavLink>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg border border-[#2563EB]/30 px-4 py-2 text-sm font-medium text-[#2563EB] transition-colors hover:bg-[#2563EB]/5"
            >
              <Home className="h-4 w-4" />
              Mon espace
            </Link>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-slate-600 transition-colors hover:text-[#1B2A6B]"
              >
                Se connecter
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Essayer gratuitement
              </Link>
            </>
          )}
        </div>

        {/* Mobile: CTA + hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg border border-[#2563EB]/30 px-3 py-1.5 text-xs font-medium text-[#2563EB]"
            >
              Mon espace
            </Link>
          ) : (
            <Link
              href="/auth/signup"
              className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white"
            >
              Essayer
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-16 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 right-0 top-16 z-50 w-[280px] overflow-y-auto bg-white p-6 shadow-2xl lg:hidden"
            >
              <MobileSection title="Produit" links={produitLinks} onClose={() => setMobileOpen(false)} />
              <MobileSection title="Solutions" links={solutionsLinks} onClose={() => setMobileOpen(false)} />
              <div className="mb-6 space-y-3">
                <MobileLink href="/pricing" onClick={() => setMobileOpen(false)}>Tarifs</MobileLink>
                <MobileLink href="/blog" onClick={() => setMobileOpen(false)}>Blog</MobileLink>
                <MobileLink href="/faq" onClick={() => setMobileOpen(false)}>FAQ</MobileLink>
              </div>
              <div className="border-t border-slate-100 pt-4">
                {user ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-[#2563EB]/30 py-2.5 text-sm font-medium text-[#2563EB]"
                  >
                    <Home className="h-4 w-4" />
                    Mon espace
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/auth/signin"
                      onClick={() => setMobileOpen(false)}
                      className="mb-3 block text-center text-sm font-medium text-slate-600"
                    >
                      Se connecter
                    </Link>
                    <Link
                      href="/auth/signup"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg bg-[#2563EB] py-2.5 text-center text-sm font-medium text-white"
                    >
                      Commencer gratuitement
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  )
}

/* ─── Sub-components ─── */

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#1B2A6B]"
    >
      {children}
      <span className="absolute bottom-0 left-3 right-3 h-[2px] origin-left scale-x-0 bg-[#2563EB] transition-transform duration-200 group-hover:scale-x-100" />
    </Link>
  )
}

function NavDropdown({
  label,
  links,
  open,
  onToggle,
  onClose,
}: {
  label: string
  links: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  return (
    <div className="relative" onMouseEnter={onToggle} onMouseLeave={onClose}>
      <button
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#1B2A6B]"
        onClick={onToggle}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 top-full w-[240px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
          >
            {links.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
              >
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#1B2A6B]"
                >
                  <link.icon className="h-4 w-4 text-[#2563EB]" />
                  {link.label}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MobileSection({
  title,
  links,
  onClose,
}: {
  title: string
  links: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]
  onClose: () => void
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <div className="space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            <link.icon className="h-4 w-4 text-[#2563EB]" />
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
    >
      {children}
    </Link>
  )
}
