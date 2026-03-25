import { MarketingFooter } from "@/components/marketing/Footer"

/**
 * Layout pour les pages marketing publiques.
 *
 * Force le mode clair (light) pour tout le contenu marketing,
 * indépendamment du thème système de l'utilisateur.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="light bg-white text-slate-900 font-display" style={{ colorScheme: "light" }}>
      {children}
      <MarketingFooter />
    </div>
  )
}
