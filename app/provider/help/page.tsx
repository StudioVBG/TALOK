"use client";
// @ts-nocheck

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  Search,
  MessageSquare,
  Phone,
  Mail,
  FileText,
  Briefcase,
  CreditCard,
  Calendar,
  Star,
  Send,
  Loader2,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const faqCategories = [
  {
    title: "Missions & Interventions",
    icon: Briefcase,
    color: "text-orange-500",
    questions: [
      {
        question: "Comment accepter une nouvelle mission ?",
        answer:
          "Depuis votre tableau de bord, cliquez sur 'Mes missions'. Les nouvelles missions apparaissent avec le statut 'En attente'. Cliquez sur une mission pour voir les détails et acceptez-la si elle vous convient.",
      },
      {
        question: "Comment signaler un problème pendant une intervention ?",
        answer:
          "Dans les détails de la mission, utilisez le bouton 'Signaler un problème' pour informer le propriétaire. Vous pouvez ajouter des photos et une description du problème rencontré.",
      },
      {
        question: "Que faire si je ne peux pas me rendre à une intervention ?",
        answer:
          "Prévenez le propriétaire le plus tôt possible via la messagerie de la mission. Si l'intervention est urgente, contactez-le par téléphone. Vous pouvez proposer une nouvelle date.",
      },
    ],
  },
  {
    title: "Facturation & Paiements",
    icon: CreditCard,
    color: "text-green-500",
    questions: [
      {
        question: "Comment créer une facture ?",
        answer:
          "Après avoir terminé une intervention, accédez à 'Mes factures' et cliquez sur 'Nouvelle facture'. Sélectionnez la mission concernée, ajoutez vos lignes de facturation et envoyez.",
      },
      {
        question: "Quand suis-je payé ?",
        answer:
          "Les paiements sont généralement effectués sous 30 jours après validation de la facture par le propriétaire. Vous recevrez une notification une fois le paiement effectué.",
      },
      {
        question: "Comment modifier une facture envoyée ?",
        answer:
          "Une facture envoyée ne peut pas être modifiée. Vous devez créer un avoir puis une nouvelle facture si des corrections sont nécessaires.",
      },
    ],
  },
  {
    title: "Calendrier & Disponibilités",
    icon: Calendar,
    color: "text-blue-500",
    questions: [
      {
        question: "Comment gérer mon calendrier ?",
        answer:
          "Accédez à 'Calendrier' dans le menu. Vous pouvez y voir toutes vos interventions planifiées et définir vos plages de disponibilité.",
      },
      {
        question: "Comment bloquer des créneaux ?",
        answer:
          "Dans le calendrier, cliquez sur un créneau et sélectionnez 'Bloquer'. Les propriétaires ne pourront pas vous proposer de missions sur ces créneaux.",
      },
    ],
  },
  {
    title: "Avis & Réputation",
    icon: Star,
    color: "text-yellow-500",
    questions: [
      {
        question: "Comment sont calculés mes avis ?",
        answer:
          "Votre note globale est la moyenne de tous les avis laissés par les propriétaires après vos interventions. Elle prend en compte la qualité du travail, la ponctualité et le professionnalisme.",
      },
      {
        question: "Puis-je répondre à un avis négatif ?",
        answer:
          "Oui, vous pouvez répondre à chaque avis depuis la section 'Mes avis'. Restez professionnel et constructif dans vos réponses.",
      },
    ],
  },
];

export default function ProviderHelpPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactForm, setContactForm] = useState({
    subject: "",
    message: "",
  });

  const filteredFaq = faqCategories
    .map((category) => ({
      ...category,
      questions: category.questions.filter(
        (q) =>
          q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.questions.length > 0);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.subject || !contactForm.message) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }

    setContactLoading(true);
    try {
      // Simulation d'envoi
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast({
        title: "Message envoyé !",
        description: "Notre équipe vous répondra sous 24-48h.",
      });
      setContactForm({ subject: "", message: "" });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message.",
        variant: "destructive",
      });
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-slate-50"
    >
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 mb-4">
            <HelpCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-orange-900 to-slate-900 bg-clip-text text-transparent">
            Centre d'aide
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Trouvez des réponses à vos questions ou contactez notre équipe support
          </p>
        </motion.div>

        {/* Recherche */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher dans l'aide..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 text-lg bg-white/80 backdrop-blur-sm shadow-sm"
            />
          </div>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Mes missions", href: "/provider/jobs", icon: Briefcase },
            { label: "Mes factures", href: "/provider/invoices", icon: FileText },
            { label: "Calendrier", href: "/provider/calendar", icon: Calendar },
            { label: "Mes avis", href: "/provider/reviews", icon: Star },
          ].map((link) => (
            <Link key={link.label} href={link.href}>
              <Card className="bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center">
                  <link.icon className="h-6 w-6 text-orange-500" />
                  <span className="text-sm font-medium">{link.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </motion.div>

        {/* FAQ */}
        <motion.div variants={itemVariants} className="mb-12">
          <h2 className="text-xl font-semibold mb-6">Questions fréquentes</h2>
          
          {filteredFaq.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Aucun résultat pour "{searchQuery}"
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredFaq.map((category) => (
                <Card key={category.title} className="bg-white/80 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <category.icon className={cn("h-5 w-5", category.color)} />
                      {category.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.questions.map((item, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                          <AccordionTrigger className="text-left hover:no-underline">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>

        {/* Contact */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-orange-500" />
                Contactez-nous
              </CardTitle>
              <CardDescription>
                Vous n'avez pas trouvé de réponse ? Envoyez-nous un message
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Sujet</Label>
                    <Input
                      id="subject"
                      value={contactForm.subject}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, subject: e.target.value })
                      }
                      placeholder="Ex: Question sur la facturation"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={contactForm.message}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, message: e.target.value })
                      }
                      placeholder="Décrivez votre problème..."
                      rows={5}
                      className="bg-white resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={contactLoading}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                  >
                    {contactLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Envoyer le message
                      </>
                    )}
                  </Button>
                </form>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-orange-500" />
                      Support téléphonique
                    </h4>
                    <p className="text-sm text-muted-foreground mb-1">
                      Du lundi au vendredi, 9h-18h
                    </p>
                    <p className="font-semibold">01 23 45 67 89</p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-slate-500" />
                      Email
                    </h4>
                    <p className="text-sm text-muted-foreground mb-1">
                      Réponse sous 24-48h
                    </p>
                    <a
                      href="mailto:support-prestataires@talok.fr"
                      className="font-semibold text-orange-600 hover:underline"
                    >
                      support-prestataires@talok.fr
                    </a>
                  </div>

                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      Documentation
                    </h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Consultez notre guide complet
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/blog" target="_blank">
                        Voir la documentation
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

