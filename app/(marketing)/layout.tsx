import { Header } from "@/components/marketing/header/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { ScrollProgressBar } from "@/components/marketing/scroll-progress-bar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background text-foreground font-display">
      <ScrollProgressBar />
      <Header />
      {children}
      <MarketingFooter />
    </div>
  );
}
