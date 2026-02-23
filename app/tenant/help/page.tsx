"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  HelpCircle, 
  MessageSquare, 
  Mail, 
  FileText, 
  ExternalLink,
  BookOpen,
  Search
} from "lucide-react";
import Link from "next/link";

const FAQ_CATEGORIES = ["Tout", "Loyer", "Documents", "Bail", "Technique"] as const;

type FaqCategory = "Loyer" | "Documents" | "Bail" | "Technique";
const faqItems: Array<{ question: string; answer: string; category: FaqCategory }> = [
  { question: "Comment payer mon loyer ?", answer: "Rendez-vous dans la section 'Paiements' pour régler votre loyer par carte bancaire ou virement.", category: "Loyer" },
  { question: "Quand est débité mon loyer ?", answer: "Le prélèvement a lieu le 1er de chaque mois. Pensez à avoir des fonds disponibles.", category: "Loyer" },
  { question: "Puis-je modifier ma date de prélèvement ?", answer: "Non, la date est fixée au 1er du mois. En cas de difficulté, contactez votre propriétaire.", category: "Loyer" },
  { question: "Comment signaler un problème dans mon logement ?", answer: "Utilisez la section 'Demandes' pour créer un ticket de maintenance. Votre propriétaire sera notifié.", category: "Technique" },
  { question: "Où trouver mes quittances de loyer ?", answer: "Vos quittances sont disponibles dans la section 'Documents' une fois le paiement validé.", category: "Documents" },
  { question: "Comment obtenir une attestation de loyer ?", answer: "Dans 'Documents', demandez une attestation. Elle est générée sous 24h.", category: "Documents" },
  { question: "Où est mon bail signé ?", answer: "Votre bail signé se trouve dans la section 'Documents', onglet Bail.", category: "Documents" },
  { question: "Comment contacter mon propriétaire ?", answer: "Utilisez la messagerie intégrée dans la section 'Messages' pour communiquer avec votre propriétaire.", category: "Technique" },
  { question: "Comment résilier mon bail ?", answer: "Envoi d'un préavis écrit au propriétaire (3 mois pour une location vide, 1 mois pour du meublé). Utilisez la section Messages.", category: "Bail" },
  { question: "Qu'est-ce que l'état des lieux d'entrée ?", answer: "C'est un document qui décrit l'état du logement à votre entrée. À signer avec le propriétaire.", category: "Bail" },
  { question: "Puis-je sous-louer ?", answer: "La sous-location doit être autorisée par le bail et le propriétaire. Consultez votre bail.", category: "Bail" },
  { question: "Mon compte ne se connecte pas, que faire ?", answer: "Utilisez 'Mot de passe oublié' sur l'écran de connexion ou contactez support@talok.fr.", category: "Technique" },
  { question: "Comment mettre à jour mon RIB ?", answer: "Allez dans Paramètres > Paiements pour enregistrer un nouveau moyen de paiement.", category: "Loyer" },
  { question: "Où voir mes relevés de compteurs ?", answer: "Dans la section 'Compteurs', vous pouvez consulter l'historique et saisir un nouvel index.", category: "Technique" },
  { question: "Comment ajouter un colocataire ?", answer: "Seul le propriétaire peut inviter un colocataire. Demandez-lui de vous ajouter via le bail.", category: "Bail" },
];

export default function TenantHelpPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Tout");

  const filteredFaq = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faqItems.filter((item) => {
      const matchCategory = activeCategory === "Tout" || item.category === activeCategory;
      const matchSearch = !q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [search, activeCategory]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Aide & Support</h1>
        <p className="text-muted-foreground mt-1">
          Trouvez des réponses à vos questions
        </p>
      </div>

      {/* Contact rapide */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-1">Chat en ligne</h3>
            <p className="text-sm text-muted-foreground">Réponse en quelques minutes</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-1">Email</h3>
            <p className="text-sm text-muted-foreground">support@talok.fr</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-1">Centre d'aide</h3>
            <p className="text-sm text-muted-foreground">Articles et guides</p>
          </CardContent>
        </Card>
      </div>

      {/* Recherche FAQ */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher dans les FAQ…”
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl h-12"
        />
      </div>

      {/* Catégories */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FAQ_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            size="sm"
            className="rounded-xl font-bold"
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Questions fréquentes
          </CardTitle>
          <CardDescription>
            Les réponses aux questions les plus posées
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredFaq.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucune question ne correspond à votre recherche.</p>
            ) : (
              filteredFaq.map((item, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {item.category}
                    </span>
                    <h4 className="font-medium">{item.question}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lien vers le blog */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold">Consultez notre blog</h3>
                <p className="text-sm text-muted-foreground">
                  Conseils et actualités pour les locataires
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/blog">
                Voir le blog
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

