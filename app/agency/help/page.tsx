"use client";

import { motion } from "framer-motion";
import {
  HelpCircle,
  Book,
  MessageCircle,
  Phone,
  Mail,
  ExternalLink,
  FileText,
  Video,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const helpCategories = [
  {
    title: "Démarrage rapide",
    description: "Apprenez à configurer votre agence",
    icon: Book,
    articles: [
      "Créer votre premier mandat",
      "Inviter un propriétaire",
      "Configurer vos commissions",
      "Ajouter votre équipe",
    ],
  },
  {
    title: "Gestion des mandats",
    description: "Tout sur les mandats de gestion",
    icon: FileText,
    articles: [
      "Types de mandats disponibles",
      "Modifier un mandat existant",
      "Résilier un mandat",
      "Documents obligatoires",
    ],
  },
  {
    title: "Facturation",
    description: "Honoraires et commissions",
    icon: FileText,
    articles: [
      "Calcul des commissions",
      "Générer une facture",
      "Exporter pour la comptabilité",
      "TVA et obligations fiscales",
    ],
  },
  {
    title: "Tutoriels vidéo",
    description: "Guides visuels pas à pas",
    icon: Video,
    articles: [
      "Présentation de l'interface",
      "Workflow de gestion locative",
      "Optimiser votre productivité",
      "Fonctionnalités avancées",
    ],
  },
];

export default function AgencyHelpPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Centre d'aide
        </h1>
        <p className="text-muted-foreground mt-2">
          Trouvez les réponses à vos questions et apprenez à utiliser toutes les fonctionnalités
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:shadow-lg transition-all duration-300 cursor-pointer">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold">Chat en direct</h3>
              <p className="text-sm text-white/80">Réponse en moins de 5 min</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:shadow-lg transition-all duration-300 cursor-pointer">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold">Appelez-nous</h3>
              <p className="text-sm text-white/80">01 23 45 67 89</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:shadow-lg transition-all duration-300 cursor-pointer">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold">Email support</h3>
              <p className="text-sm text-white/80">support@gestionlocative.fr</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {helpCategories.map((category) => (
          <Card key={category.title} className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                  <category.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">{category.title}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {category.articles.map((article) => (
                  <li key={article}>
                    <Button variant="ghost" className="w-full justify-start text-left h-auto py-2 px-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                      <span className="text-sm">{article}</span>
                      <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ Preview */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            Questions fréquentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <h4 className="font-medium mb-2">Comment ajouter un nouveau propriétaire ?</h4>
            <p className="text-sm text-muted-foreground">
              Rendez-vous dans "Propriétaires" puis cliquez sur "Inviter un propriétaire". 
              Renseignez son email et les détails du mandat.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <h4 className="font-medium mb-2">Comment sont calculées les commissions ?</h4>
            <p className="text-sm text-muted-foreground">
              Les commissions sont calculées automatiquement sur les loyers encaissés, 
              selon le taux défini dans chaque mandat (généralement entre 5% et 10%).
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <h4 className="font-medium mb-2">Puis-je gérer plusieurs agences ?</h4>
            <p className="text-sm text-muted-foreground">
              Oui, avec le plan Enterprise vous pouvez créer plusieurs espaces agence 
              et les gérer depuis un compte central.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact Card */}
      <Card className="border-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/10 rounded-2xl">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Besoin d'une formation ?</h3>
              <p className="text-slate-300">
                Nos experts vous accompagnent pour maîtriser tous les outils
              </p>
            </div>
          </div>
          <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
            Demander une démo
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

