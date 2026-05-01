"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HelpCircle,
  Mail,
  FileText,
  Search,
  Shield,
  Scale,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const FAQ_CATEGORIES = ["Tout", "Engagement", "Documents", "Risques", "Légal"] as const;

type FaqCategory = "Engagement" | "Documents" | "Risques" | "Légal";

const faqItems: Array<{
  question: string;
  answer: string;
  category: FaqCategory;
  link?: { href: string; label: string };
}> = [
  {
    question: "Qu'est-ce qu'un acte de cautionnement ?",
    answer:
      "C'est un engagement écrit par lequel vous garantissez les loyers et charges du locataire en cas de défaut. Cet acte a une valeur légale.",
    category: "Engagement",
  },
  {
    question: "Quelle est la différence entre caution simple et solidaire ?",
    answer:
      "La caution solidaire permet au propriétaire de vous demander le paiement immédiatement sans poursuivre d'abord le locataire. La caution simple impose au propriétaire d'épuiser tous les recours contre le locataire avant.",
    category: "Engagement",
  },
  {
    question: "Quel est le montant maximum de mon engagement ?",
    answer:
      "Le montant et la durée sont précisés dans votre acte de cautionnement. Vous pouvez le consulter dans la section Engagements.",
    category: "Engagement",
    link: { href: "/guarantor/dashboard", label: "Voir mes engagements" },
  },
  {
    question: "Quels documents dois-je fournir ?",
    answer:
      "Pièce d'identité, justificatif de domicile, 3 derniers bulletins de salaire, dernier avis d'imposition. Tous se déposent dans Documents.",
    category: "Documents",
    link: { href: "/guarantor/documents", label: "Mes documents" },
  },
  {
    question: "Mes documents sont-ils sécurisés ?",
    answer:
      "Oui, ils sont chiffrés et stockés en France. Seuls vous, le locataire et le propriétaire concerné y avez accès.",
    category: "Documents",
  },
  {
    question: "Que se passe-t-il si le locataire ne paie pas ?",
    answer:
      "Vous serez notifié par email. Le propriétaire peut vous demander le paiement des sommes dues selon les termes de votre acte (caution simple ou solidaire).",
    category: "Risques",
  },
  {
    question: "Puis-je me désengager avant la fin du bail ?",
    answer:
      "L'engagement court jusqu'à la fin du bail (ou la durée fixée). Une libération anticipée nécessite l'accord du propriétaire ou un cas légal (fin de bail, accord parties, etc.).",
    category: "Légal",
  },
  {
    question: "Que devient mon engagement à la fin du bail ?",
    answer:
      "L'engagement se termine automatiquement à la fin du bail si le locataire est à jour de ses obligations. Vous recevez une notification de libération.",
    category: "Légal",
  },
  {
    question: "La signature électronique a-t-elle valeur légale ?",
    answer:
      "Oui, elle a la même valeur juridique qu'une signature manuscrite (eIDAS). Elle inclut un audit trail horodaté.",
    category: "Légal",
  },
  {
    question: "Comment contacter le support ?",
    answer:
      "Par email à support@talok.fr ou via le formulaire ci-dessous. Réponse sous 24h ouvrées.",
    category: "Légal",
  },
];

export default function GuarantorHelpPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof FAQ_CATEGORIES)[number]>("Tout");

  const filtered = useMemo(() => {
    return faqItems.filter((item) => {
      const matchCategory = category === "Tout" || item.category === category;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [search, category]);

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Aide</h1>
          <p className="text-muted-foreground">
            Réponses aux questions fréquentes des garants.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une question..."
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FAQ_CATEGORIES.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={category === cat ? "default" : "outline"}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucune question ne correspond à votre recherche.
            </CardContent>
          </Card>
        ) : (
          filtered.map((item, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-base">{item.question}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{item.answer}</p>
                {item.link && (
                  <Link href={item.link.href}>
                    <Button variant="outline" size="sm" className="gap-2">
                      {item.link.label}
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Contacter le support
          </CardTitle>
          <CardDescription>
            Une question spécifique ? Notre équipe vous répond sous 24h ouvrées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="mailto:support@talok.fr">
            <Button>
              <Mail className="w-4 h-4 mr-2" />
              support@talok.fr
            </Button>
          </a>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/guarantor/dashboard">
          <Card className="hover:bg-muted/50 transition cursor-pointer">
            <CardContent className="pt-6 flex flex-col items-center gap-2 text-center">
              <Shield className="w-8 h-8 text-primary" />
              <p className="font-medium">Mes engagements</p>
              <p className="text-xs text-muted-foreground">
                Consultez vos cautionnements actifs
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/guarantor/documents">
          <Card className="hover:bg-muted/50 transition cursor-pointer">
            <CardContent className="pt-6 flex flex-col items-center gap-2 text-center">
              <FileText className="w-8 h-8 text-primary" />
              <p className="font-medium">Mes documents</p>
              <p className="text-xs text-muted-foreground">
                Pièces justificatives et acte de caution
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/guarantor/profile">
          <Card className="hover:bg-muted/50 transition cursor-pointer">
            <CardContent className="pt-6 flex flex-col items-center gap-2 text-center">
              <Scale className="w-8 h-8 text-primary" />
              <p className="font-medium">Mon profil</p>
              <p className="text-xs text-muted-foreground">
                Mettre à jour mes informations
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
