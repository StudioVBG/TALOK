"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Building,
  Calculator,
  ClipboardCheck,
  Users,
  FileText,
  Palmtree,
  Download,
  Sparkles,
} from "lucide-react";

// Données des guides (même source que la page index)
const GUIDES: Record<string, {
  title: string;
  description: string;
  icon: typeof Building;
  pages: number;
  downloadable: boolean;
  content: string[];
}> = {
  "proprietaire-bailleur": {
    title: "Guide Complet du Propriétaire Bailleur 2026",
    description: "Tout ce que vous devez savoir pour louer sereinement.",
    icon: Building,
    pages: 25,
    downloadable: true,
    content: [
      "La mise en location : étapes clés et obligations légales",
      "Choisir entre location nue et meublée : avantages et inconvénients",
      "Le bail : clauses essentielles et pièges à éviter",
      "L'état des lieux : bonnes pratiques pour protéger votre bien",
      "La gestion des loyers : facturation, relances et quittances",
      "Les charges locatives : répartition et régularisation annuelle",
      "La fiscalité du bailleur : micro-foncier vs régime réel",
      "Les travaux : qui paie quoi entre propriétaire et locataire ?",
      "Le dépôt de garantie : encaissement et restitution",
      "Le départ du locataire : préavis, EDL sortie et solde de tout compte",
    ],
  },
  "checklist-mise-en-location": {
    title: "Checklist Mise en Location",
    description: "La liste complète des étapes pour mettre votre bien en location.",
    icon: ClipboardCheck,
    pages: 5,
    downloadable: true,
    content: [
      "Vérifier la conformité du logement (diagnostics, surface, décence)",
      "Préparer les diagnostics obligatoires (DPE, amiante, électricité, gaz)",
      "Rédiger l'annonce immobilière : photos et description",
      "Organiser les visites et sélectionner le locataire",
      "Constituer le dossier locatif et vérifier les garanties",
      "Rédiger le bail conforme à la loi ALUR",
      "Réaliser l'état des lieux d'entrée",
      "Remettre les clés et les documents au locataire",
    ],
  },
  "gestion-sci": {
    title: "Guide Gestion Locative en SCI",
    description: "Multi-associés, AG, répartition des bénéfices.",
    icon: Users,
    pages: 15,
    downloadable: true,
    content: [
      "Création d'une SCI : formalités et statuts types",
      "SCI à l'IR vs SCI à l'IS : quel régime fiscal choisir ?",
      "La gestion des associés et les assemblées générales",
      "La comptabilité de la SCI : obligations et bonnes pratiques",
      "Répartition des bénéfices et des charges entre associés",
      "Les apports en nature et en numéraire",
      "La cession de parts sociales : procédure et fiscalité",
      "Talok et la SCI : gérer vos biens en multi-entités",
    ],
  },
  "fiscalite-locative": {
    title: "Tout sur la Fiscalité Locative",
    description: "Micro-foncier, réel, LMNP, déficit foncier.",
    icon: Calculator,
    pages: 20,
    downloadable: true,
    content: [
      "Location nue : micro-foncier ou régime réel ?",
      "LMNP : le régime micro-BIC simplifié",
      "Le déficit foncier : comment l'utiliser pour réduire vos impôts",
      "La déclaration 2044 : remplir pas à pas",
      "Les charges déductibles en location nue et meublée",
      "L'amortissement en LMNP : un avantage fiscal majeur",
      "IFI et immobilier locatif : ce qu'il faut savoir",
      "Cas pratique : optimisation fiscale d'un portefeuille",
    ],
  },
  "etat-des-lieux-parfait": {
    title: "Guide de l'État des Lieux Parfait",
    description: "Conseils d'experts pour réaliser des EDL complets.",
    icon: ClipboardCheck,
    pages: 12,
    downloadable: true,
    content: [
      "Cadre légal de l'état des lieux (loi ALUR)",
      "Les mentions obligatoires de l'EDL",
      "Pièce par pièce : méthodologie de contrôle",
      "Photographier les dégradations : bonnes pratiques",
      "Les compteurs : relever et vérifier",
      "Les clés : inventaire complet",
      "EDL contradictoire vs unilatéral",
      "Litiges et recours en cas de désaccord",
    ],
  },
  "lettres-bailleur": {
    title: "15 Modèles de Lettres du Bailleur",
    description: "Relances, congés, régularisation, augmentation...",
    icon: FileText,
    pages: 15,
    downloadable: true,
    content: [
      "Lettre de relance pour loyer impayé (1er rappel)",
      "Mise en demeure pour loyers impayés",
      "Congé pour vente (avec préavis de 6 mois)",
      "Congé pour reprise personnelle",
      "Notification de régularisation des charges",
      "Notification d'augmentation de loyer (indice IRL)",
      "Attestation d'assurance habitation - demande",
      "Restitution du dépôt de garantie",
    ],
  },
  "investissement-dom-tom": {
    title: "Guide Investissement DOM-TOM",
    description: "Pinel Outre-Mer, Girardin, spécificités locales.",
    icon: Palmtree,
    pages: 18,
    downloadable: true,
    content: [
      "Panorama de l'investissement en Outre-Mer",
      "Le Pinel Outre-Mer : réduction d'impôt jusqu'à 32%",
      "Le dispositif Girardin : avantages et conditions",
      "Spécificités locatives en Martinique et Guadeloupe",
      "Le marché immobilier à La Réunion",
      "Guyane et Mayotte : opportunités et contraintes",
      "Fiscalité spécifique des DOM-TOM (TVA, octroi de mer)",
      "Talok : gestion locative adaptée aux territoires d'Outre-Mer",
    ],
  },
  "declaration-2044": {
    title: "Déclaration 2044 : Guide Pas à Pas",
    description: "Remplir votre déclaration de revenus fonciers sans erreur.",
    icon: Calculator,
    pages: 12,
    downloadable: true,
    content: [
      "Qui doit remplir la déclaration 2044 ?",
      "Revenus fonciers : que déclarer exactement ?",
      "Charges déductibles : la liste exhaustive",
      "Travaux déductibles vs non déductibles",
      "Intérêts d'emprunt : comment les déclarer",
      "Le déficit foncier : calcul et report",
      "Cas pratique : remplir la 2044 ligne par ligne",
      "Les erreurs fréquentes à éviter",
      "2044 spéciale vs 2044 normale : quand utiliser laquelle ?",
      "Talok : export automatique de vos données fiscales",
    ],
  },
  "checklist-fin-bail": {
    title: "Checklist Fin de Bail",
    description: "Toutes les étapes du départ du locataire.",
    icon: ClipboardCheck,
    pages: 4,
    downloadable: false,
    content: [
      "Réception du préavis : vérifier la validité et les délais",
      "Planifier l'état des lieux de sortie",
      "Comparer EDL entrée et sortie",
      "Calculer les retenues éventuelles sur le dépôt de garantie",
      "Restituer le dépôt dans le délai légal (1 ou 2 mois)",
      "Régularisation des charges après départ",
      "Solde de tout compte et documents de fin de bail",
    ],
  },
};

export default function GuidePage() {
  const params = useParams();
  const slug = params.slug as string;
  const guide = GUIDES[slug];

  if (!guide) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Guide non trouvé</h1>
            <p className="text-muted-foreground mb-6">
              Ce guide n&apos;est pas encore disponible.
            </p>
            <Button asChild>
              <Link href="/guides">Voir tous les guides</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = guide.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="container mx-auto px-4 pt-12 pb-8">
        <Link
          href="/guides"
          className="text-sm text-slate-400 hover:text-white flex items-center gap-1 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux guides
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Icon className="w-7 h-7 text-indigo-400" />
            </div>
            <div className="flex gap-2">
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                <BookOpen className="w-3 h-3 mr-1" />
                {guide.pages} pages
              </Badge>
              {guide.downloadable && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <Download className="w-3 h-3 mr-1" />
                  PDF disponible
                </Badge>
              )}
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {guide.title}
          </h1>
          <p className="text-lg text-slate-400">
            {guide.description}
          </p>
        </motion.div>
      </div>

      {/* Contenu */}
      <div className="container mx-auto px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-3xl space-y-6"
        >
          <Card className="bg-slate-800/30 border-slate-700/50">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-xl font-semibold text-white mb-6">Sommaire</h2>
              <ol className="space-y-4">
                {guide.content.map((item, index) => (
                  <li key={index} className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-400">
                      {index + 1}
                    </span>
                    <p className="text-slate-300 pt-1">{item}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* CTA d'inscription */}
          <Card className="bg-gradient-to-br from-indigo-900/50 to-violet-900/50 border-indigo-500/30">
            <CardContent className="p-6 md:p-8 text-center">
              <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">
                Accédez au guide complet gratuitement
              </h3>
              <p className="text-slate-300 mb-6 max-w-md mx-auto">
                Créez votre compte Talok pour télécharger ce guide et profiter de tous nos outils de gestion locative.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-white text-slate-900 hover:bg-slate-100">
                  <Link href="/auth/signup">
                    Créer mon compte gratuit
                  </Link>
                </Button>
                {guide.downloadable && (
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger le PDF
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
