"use client"

import {
  FileText, CreditCard, ClipboardCheck, PieChart,
  FolderOpen, Wrench, Bot, BarChart3, MapPin, Wand2,
} from "lucide-react"
import { HeroSection } from "@/components/marketing/sections/HeroSection"
import { TrustBar } from "@/components/marketing/sections/TrustBar"
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline"
import type { TimelineItem } from "@/components/ui/radial-orbital-timeline"
import { ArgumentsSection } from "@/components/landing/ArgumentsSection"
import { Features } from "@/components/marketing/sections/Features"
import { PropertyTypes } from "@/components/marketing/sections/PropertyTypes"
import { Pricing } from "@/components/marketing/sections/Pricing"
import { CompetitorComparison } from "@/components/marketing/sections/CompetitorComparison"
import { Testimonials } from "@/components/marketing/sections/Testimonials"
import { AnimatedTestimonialGrid } from "@/components/ui/testimonial-2"
import { OutreMer } from "@/components/marketing/sections/OutreMer"
import { FAQ } from "@/components/marketing/sections/FAQ"
import { FinalCTA, StickyMobileCTA } from "@/components/marketing/sections/FinalCTA"

const orbitalFeatures: TimelineItem[] = [
  {
    id: 1,
    title: "Contrats de bail",
    date: "Tous plans",
    content: "Créez et faites signer vos baux en quelques clics. Bail nu, meublé, colocation ou saisonnier — toujours conforme à la loi.",
    category: "Juridique",
    icon: FileText,
    relatedIds: [2, 6],
    status: "completed",
    energy: 95,
  },
  {
    id: 2,
    title: "Encaissement loyers",
    date: "Tous plans",
    content: "Loyers encaissés par CB ou prélèvement SEPA. Relances automatiques, quittances générées et envoyées sans effort.",
    category: "Finance",
    icon: CreditCard,
    relatedIds: [1, 4],
    status: "completed",
    energy: 90,
  },
  {
    id: 3,
    title: "États des lieux",
    date: "Tous plans",
    content: "EDL numériques avec photos, annotations et signatures sur place. Entrée et sortie comparées automatiquement.",
    category: "Terrain",
    icon: ClipboardCheck,
    relatedIds: [1, 6],
    status: "completed",
    energy: 85,
  },
  {
    id: 4,
    title: "Comptabilité",
    date: "Tous plans",
    content: "Export FEC, grand livre, balance — tout est prêt pour votre déclaration fiscale. Compatible 2044, BIC et micro-foncier.",
    category: "Finance",
    icon: PieChart,
    relatedIds: [2, 8],
    status: "completed",
    energy: 80,
  },
  {
    id: 5,
    title: "Tickets & travaux",
    date: "Tous plans",
    content: "Vos locataires signalent un problème, vous assignez un prestataire, tout est suivi dans un fil unique.",
    category: "Maintenance",
    icon: Wrench,
    relatedIds: [6, 10],
    status: "completed",
    energy: 75,
  },
  {
    id: 6,
    title: "Documents cloud",
    date: "Tous plans",
    content: "Baux, quittances, EDL, attestations — tous vos documents archivés, signés et accessibles partout.",
    category: "Stockage",
    icon: FolderOpen,
    relatedIds: [1, 3],
    status: "completed",
    energy: 85,
  },
  {
    id: 7,
    title: "Assistant IA",
    date: "Pro & Plus",
    content: "TALO, votre assistant IA, analyse vos documents, conseille sur la fiscalité et score les candidatures locataires.",
    category: "Intelligence",
    icon: Bot,
    relatedIds: [4, 10],
    status: "in-progress",
    energy: 70,
  },
  {
    id: 8,
    title: "Tableau de bord",
    date: "Tous plans",
    content: "KPIs et rentabilité par bien, taux d\u2019occupation, loyers impayés — tout en temps réel.",
    category: "Analytics",
    icon: BarChart3,
    relatedIds: [2, 4],
    status: "completed",
    energy: 90,
  },
  {
    id: 9,
    title: "DROM intégré",
    date: "Tous plans",
    content: "Martinique, Guadeloupe, Réunion, Guyane, Mayotte — diagnostics, TVA et réglementations spécifiques inclus nativement.",
    category: "Géographie",
    icon: MapPin,
    relatedIds: [1, 4],
    status: "completed",
    energy: 80,
  },
  {
    id: 10,
    title: "Automatisations",
    date: "Tous plans",
    content: "Relances loyers, envoi de quittances, alertes fin de bail, rappels assurance — tout tourne sans vous.",
    category: "Productivité",
    icon: Wand2,
    relatedIds: [2, 5, 7],
    status: "completed",
    energy: 95,
  },
]

interface Props {
  images: Record<string, string>;
}

export function LandingPageClient({ images }: Props) {
  return (
    <>
      <div className="scroll-smooth">
        <HeroSection />
        <TrustBar />
        <Features />
        <AnimatedTestimonialGrid
          testimonials={[
            { imgSrc: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=300", alt: "Propriétaire satisfait" },
            { imgSrc: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=300", alt: "Investisseur immobilier" },
            { imgSrc: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300", alt: "Gestionnaire de biens" },
            { imgSrc: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=300", alt: "Propriétaire particulière" },
            { imgSrc: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=300", alt: "Investisseur SCI" },
            { imgSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300", alt: "Bailleur privé" },
            { imgSrc: "https://images.unsplash.com/photo-1557862921-37829c790f19?q=80&w=300", alt: "Propriétaire multi-biens" },
            { imgSrc: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300", alt: "Gérant immobilier" },
            { imgSrc: "https://images.unsplash.com/photo-1619895862022-09114b41f16f?q=80&w=300", alt: "Investisseuse LMNP" },
            { imgSrc: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=300", alt: "Gérante d'agence" },
            { imgSrc: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=300", alt: "Propriétaire en copropriété" },
            { imgSrc: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300", alt: "Bailleuse particulière" },
          ]}
          badgeText="Pour qui ?"
          title={<>Une solution adoptée<br />par chaque profil</>}
          description="Particuliers, investisseurs, professionnels, agences — ils sont nombreux à faire confiance à TALOK pour gérer leurs locations sereinement."
          ctaText="Découvrir les offres"
          ctaHref="/pricing"
        />

        {/* Orbital — Tout-en-un */}
        <section id="tout-en-un" className="py-10 md:py-14">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-6 text-center">
              <span className="inline-block rounded-full bg-[#2563EB]/10 px-4 py-1.5 text-sm font-semibold text-[#2563EB] mb-3">
                Tout-en-un
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1B2A6B] mb-2">
                10 modules, une seule plateforme
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto text-sm">
                Cliquez sur chaque noeud pour explorer les fonctionnalités.
              </p>
            </div>
            <RadialOrbitalTimeline timelineData={orbitalFeatures} />
          </div>
        </section>

        <ArgumentsSection images={images} />
        <PropertyTypes />
        <Pricing />
        <CompetitorComparison />
        <Testimonials />
        <OutreMer />
        <FAQ />
        <FinalCTA />
      </div>
      <StickyMobileCTA />
    </>
  )
}
