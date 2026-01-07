"use client";
// @ts-nocheck

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  HelpCircle, 
  MessageSquare, 
  Phone, 
  Mail, 
  FileText, 
  ExternalLink,
  ChevronRight,
  BookOpen
} from "lucide-react";
import Link from "next/link";

const faqItems = [
  {
    question: "Comment payer mon loyer ?",
    answer: "Rendez-vous dans la section 'Paiements' pour régler votre loyer par carte bancaire ou virement."
  },
  {
    question: "Comment signaler un problème dans mon logement ?",
    answer: "Utilisez la section 'Demandes' pour créer un ticket de maintenance. Votre propriétaire sera notifié."
  },
  {
    question: "Où trouver mes quittances de loyer ?",
    answer: "Vos quittances sont disponibles dans la section 'Documents' une fois le paiement validé."
  },
  {
    question: "Comment contacter mon propriétaire ?",
    answer: "Utilisez la messagerie intégrée dans la section 'Messages' pour communiquer avec votre propriétaire."
  },
];

export default function TenantHelpPage() {
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
            {faqItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">{item.question}</h4>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
              </div>
            ))}
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

