"use client";

import { motion } from "framer-motion";
import { ShoppingBag, Shield, Zap, Wifi, Truck, Heart, ArrowRight, Star, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const OFFERS = [
  {
    id: 1,
    category: "Assurance",
    provider: "Luko x Lemonade",
    title: "Assurance Habitation Premium",
    description: "Protection complète de vos biens et responsabilité civile.",
    discount: "-15% à vie",
    icon: Shield,
    color: "text-blue-600",
    bg: "bg-blue-50",
    url: "https://luko.eu"
  },
  {
    id: 2,
    category: "Énergie",
    provider: "Ekwateur",
    title: "Électricité 100% Verte",
    description: "Soutenez les producteurs français avec une énergie renouvelable.",
    discount: "1 mois offert",
    icon: Zap,
    color: "text-amber-600",
    bg: "bg-amber-50",
    url: "https://ekwateur.fr"
  },
  {
    id: 3,
    category: "Internet",
    provider: "Free",
    title: "Freebox Pop Fiber",
    description: "Le très haut débit avec installation offerte.",
    discount: "Installation 0€",
    icon: Wifi,
    color: "text-red-600",
    bg: "bg-red-50",
    url: "https://free.fr"
  },
  {
    id: 4,
    category: "Services",
    provider: "Papernest",
    title: "Assistant Déménagement",
    description: "On gère tous vos transferts de contrats gratuitement.",
    discount: "Gratuit",
    icon: Truck,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    url: "https://papernest.com"
  }
];

export default function TenantMarketplacePage() {
  const { toast } = useToast();

  const handleOfferClick = (offer: any) => {
    toast({
      title: "Redirection vers " + offer.provider,
      description: "Vous allez être redirigé vers l'offre négociée. Votre code promo a été automatiquement appliqué.",
    });
    
    // Simuler une redirection après un court délai
    setTimeout(() => {
      window.open(offer.url, "_blank");
    }, 1500);
  };
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl space-y-6 md:space-y-12">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 text-center md:text-left">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Services & Offres</h1>
            </div>
            <p className="text-slate-500 text-lg">
              Des avantages négociés exclusivement pour nos locataires.
            </p>
          </motion.div>
        </div>

        {/* Categories / Filter SOTA */}
        <div className="flex flex-wrap justify-center md:justify-start gap-3">
          {["Tout", "Assurance", "Énergie", "Internet", "Ameublement", "Services"].map((cat, i) => (
            <Button key={i} variant={i === 0 ? "default" : "outline"} className="rounded-xl font-bold h-10 px-6">
              {cat}
            </Button>
          ))}
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          {OFFERS.map((offer, i) => (
            <motion.div
              key={offer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <GlassCard className="group hover:shadow-2xl hover:border-indigo-200 transition-all duration-500 border-slate-200 bg-white overflow-hidden flex flex-col h-full">
                <div className="p-4 sm:p-6 md:p-8 space-y-4 md:space-y-6 flex-1">
                  <div className="flex items-start justify-between">
                    <div className={cn("p-4 rounded-2xl shadow-inner transition-transform group-hover:scale-110", offer.bg)}>
                      <offer.icon className={cn("h-8 w-8", offer.color)} />
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-xs uppercase tracking-widest px-3 h-7">
                      {offer.discount}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{offer.provider}</p>
                    <h3 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{offer.title}</h3>
                    <p className="text-slate-500 mt-2 leading-relaxed font-medium">{offer.description}</p>
                  </div>

                  <div className="flex items-center gap-1 text-amber-400">
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <span className="text-xs text-slate-400 font-bold ml-2">(4.9/5)</span>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Offre certifiée 2026</span>
                  <Button 
                    className="bg-slate-900 hover:bg-black text-white font-black rounded-xl px-6 h-11"
                    onClick={() => handleOfferClick(offer)}
                  >
                    Profiter de l'offre <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* SOTA Hint Section */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="mt-6 md:mt-12 p-6 md:p-10 rounded-2xl md:rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10 grid md:grid-cols-2 gap-6 md:gap-12 items-center">
            <div className="space-y-4 md:space-y-6">
              <div className="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl md:text-4xl font-black tracking-tight">Besoin d'un coup de main ?</h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                Notre assistant <strong>Tom</strong> peut s'occuper de toutes les démarches administratives liées à votre emménagement.
              </p>
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl h-14 px-10">
                Lancer l'assistant emménagement
              </Button>
            </div>
            <div className="hidden md:block">
              <div className="aspect-square rounded-full border-2 border-white/5 flex items-center justify-center relative">
                <div className="h-4/5 w-4/5 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 animate-pulse" />
                <Heart className="absolute h-24 w-24 text-white opacity-10" />
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 h-80 w-80 bg-indigo-600/10 rounded-full blur-3xl" />
        </motion.div>

      </div>
    </PageTransition>
  );
}

