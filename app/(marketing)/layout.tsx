import { MarketingNavbar } from "@/components/marketing/Navbar";
import { MarketingFooter } from "@/components/marketing/Footer";
import { ScrollProgressBar } from "@/components/marketing/scroll-progress-bar";

/**
 * Layout pour les pages marketing publiques.
 *
 * Ajoute automatiquement :
 * - La MarketingNavbar
 * - Le scroll progress bar (indicateur de progression)
 * - Le MarketingFooter
 * - Force le mode clair (light)
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background text-foreground font-display">
      {/* Scroll progress bar */}
      <ScrollProgressBar />
      <MarketingNavbar />
      {children}
      <MarketingFooter />
    </div>
  );
}
