import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Lock,
  Server,
  KeyRound,
  Database,
  Eye,
  CheckCircle2,
  FileWarning,
  Mail,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Sécurité — Hébergement France, chiffrement, RGPD",
  description:
    "Comment Talok protège vos données : hébergement en France, chiffrement TLS, double vérification, sauvegardes, RGPD. La transparence sur notre dispositif de sécurité.",
  alternates: { canonical: "https://talok.fr/securite" },
  openGraph: {
    title: "Sécurité Talok — Vos données sont protégées",
    description:
      "Hébergement en France, chiffrement bout-en-bout, double vérification, RGPD. Découvrez le dispositif de sécurité Talok.",
    type: "website",
    url: "https://talok.fr/securite",
  },
};

const PILLARS = [
  {
    icon: Server,
    title: "Hébergement en France",
    text: "Toutes vos données sont hébergées sur des serveurs situés en Union européenne, opérés par des fournisseurs certifiés ISO 27001 et SOC 2.",
  },
  {
    icon: Lock,
    title: "Chiffrement bout-en-bout",
    text: "Connexions HTTPS/TLS 1.3 pour tous les échanges. Données chiffrées au repos (AES-256) et en transit. Mots de passe hachés avec bcrypt.",
  },
  {
    icon: KeyRound,
    title: "Double vérification de sécurité",
    text: "Activez la double vérification (2FA via application d'authentification ou clé physique) pour protéger votre compte contre les accès non autorisés.",
  },
  {
    icon: Database,
    title: "Sauvegardes automatiques",
    text: "Sauvegardes quotidiennes incrémentielles + hebdomadaires complètes, conservées 30 jours. Restauration possible en moins de 4 heures.",
  },
  {
    icon: Eye,
    title: "Confidentialité par défaut",
    text: "Aucune donnée vendue à des tiers. Aucun pisteur publicitaire. Vos documents et celles de vos locataires restent strictement confidentielles.",
  },
  {
    icon: Shield,
    title: "Conformité RGPD",
    text: "Talok respecte intégralement le règlement européen RGPD. DPO joignable à dpo@talok.fr. Vous pouvez exporter ou supprimer vos données à tout moment.",
  },
];

export default function SecuritePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-16">
      <div className="container mx-auto px-4">
        <article className="max-w-4xl mx-auto">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs font-medium mb-4">
              <Shield className="w-3 h-3" />
              Données protégées · Hébergement France
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Sécurité &amp; protection de vos données
            </h1>
            <p className="text-slate-400 max-w-2xl">
              Vos baux, vos quittances, vos pièces d&apos;identité de
              locataires : tout cela mérite une protection sérieuse. Voici
              comment Talok s&apos;y engage.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mb-12">
            {PILLARS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-indigo-300" />
                </div>
                <h3 className="text-white font-semibold mb-1">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 md:p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              Bonnes pratiques côté utilisateur
            </h2>
            <ul className="space-y-3 text-slate-300 text-sm leading-relaxed">
              <li>
                <strong className="text-white">Activez la double vérification</strong>{" "}
                depuis vos paramètres de sécurité.
              </li>
              <li>
                <strong className="text-white">Utilisez un mot de passe unique</strong>{" "}
                de 12 caractères minimum, idéalement géré dans un coffre-fort.
              </li>
              <li>
                <strong className="text-white">Ne partagez jamais vos identifiants.</strong>{" "}
                Talok ne vous demandera jamais votre mot de passe par email ou
                téléphone.
              </li>
              <li>
                <strong className="text-white">Vérifiez l&apos;adresse de l&apos;expéditeur</strong>{" "}
                de tout email Talok : nous écrivons uniquement depuis
                <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs">
                  @talok.fr
                </code>
                .
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 md:p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
              <FileWarning className="w-6 h-6 text-amber-400" />
              Signaler une faille
            </h2>
            <p className="text-slate-200 leading-relaxed mb-4">
              Vous pensez avoir découvert une vulnérabilité ? Nous prenons toute
              alerte au sérieux. Écrivez-nous à{" "}
              <a
                href="mailto:security@talok.fr"
                className="text-amber-300 underline underline-offset-2 hover:text-amber-200"
              >
                security@talok.fr
              </a>{" "}
              avec une description, les étapes de reproduction et l&apos;impact.
              Nous accusons réception sous 48 h ouvrables et tenons le
              déclarant informé jusqu&apos;à résolution.
            </p>
            <p className="text-sm text-slate-400">
              Merci de respecter une divulgation responsable : ne diffusez
              aucune information avant correction.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
              <Mail className="w-6 h-6 text-indigo-400" />
              Une question ?
            </h2>
            <p className="text-slate-300 mb-4">
              Pour toute question sur la sécurité ou la protection de vos
              données, contactez notre équipe.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 transition-colors"
              >
                Contacter le support
              </Link>
              <Link
                href="/legal/privacy"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Politique de confidentialité
              </Link>
            </div>
          </section>

          <p className="text-xs text-slate-500 text-center mt-12">
            Page mise à jour le 3 mai 2026.
          </p>
        </article>
      </div>
    </div>
  );
}
