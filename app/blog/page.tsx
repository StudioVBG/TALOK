import Link from "next/link";
import { BookOpen, ArrowRight, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  // Layout racine: template "%s | Talok" — ne pas repeter "| Talok" ici.
  title: "Blog",
  description:
    "Conseils, actualites et guides pratiques pour la gestion locative. Bientot disponible.",
  alternates: { canonical: "https://talok.fr/blog" },
};

export default function BlogPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-24">
      <div className="max-w-lg text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Le blog Talok arrive bientot
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Conseils pratiques, actualites juridiques et guides pour optimiser
          votre gestion locative. Inscrivez-vous pour etre prevenu du lancement.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/auth/signup">
            <Button size="lg" className="gap-2">
              <Bell className="h-4 w-4" />
              Etre prevenu du lancement
            </Button>
          </Link>
          <Link href="/guides">
            <Button variant="outline" size="lg" className="gap-2">
              Voir nos guides
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
