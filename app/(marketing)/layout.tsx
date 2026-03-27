import { MarketingNavbar } from "@/components/marketing/Navbar"
import { MarketingFooter } from "@/components/marketing/Footer"

/**
 * Layout pour les pages marketing publiques.
 *
 * Force le mode clair (light) pour tout le contenu marketing,
 * independamment du theme systeme de l'utilisateur.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="light bg-white text-slate-900 font-display" style={{ colorScheme: "light" }}>
      <MarketingNavbar />
      {children}
      <MarketingFooter />
    </div>
  )
}
