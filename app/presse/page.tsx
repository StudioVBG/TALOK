import Image from "next/image";
import {
  Newspaper,
  Download,
  Mail,
  MapPin,
  Calendar,
  Target,
  Building2,
  Heart,
} from "lucide-react";
import { PressContactForm } from "@/components/marketing/PressContactForm";

const LOGOS = [
  {
    label: "Logo horizontal (PNG)",
    src: "/images/talok-logo-horizontal.png",
    href: "/images/talok-logo-horizontal.png",
    preview: true,
  },
  {
    label: "Logo horizontal badge (SVG)",
    src: "/images/talok-logo-horizontal-badge.svg",
    href: "/images/talok-logo-horizontal-badge.svg",
    preview: true,
  },
  {
    label: "Icône app (PNG)",
    src: "/images/talok-icon.png",
    href: "/images/talok-icon.png",
    preview: true,
  },
];

const KEY_FACTS = [
  {
    icon: Calendar,
    label: "Création",
    value: "2026",
  },
  {
    icon: MapPin,
    label: "Origine",
    value: "Fort-de-France, Martinique",
  },
  {
    icon: Building2,
    label: "Éditeur",
    value: "Explore Moi",
  },
  {
    icon: Target,
    label: "Mission",
    value: "Démocratiser l'autogestion locative",
  },
];

export default function PressePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-16">
      <div className="container mx-auto px-4">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 text-xs font-medium mb-4">
            <Newspaper className="w-3 h-3" />
            Espace presse
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Talok dans les médias
          </h1>
          <p className="text-xl text-slate-400">
            Logos, identité visuelle, chiffres clés et contact presse. Vous
            préparez un article sur Talok ? Vous trouverez tout ici.
          </p>
        </div>

        {/* Key facts */}
        <section className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">En bref</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {KEY_FACTS.map((fact) => (
              <div
                key={fact.label}
                className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5"
              >
                <fact.icon className="w-5 h-5 text-blue-400 mb-3" />
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                  {fact.label}
                </p>
                <p className="text-white font-semibold">{fact.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pitch */}
        <section className="max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-white mb-4">À propos de Talok</h2>
          <div className="space-y-4 text-slate-300">
            <p>
              <strong className="text-white">Talok</strong> est un logiciel de
              gestion locative tout-en-un destiné aux propriétaires bailleurs,
              investisseurs et agences immobilières en France métropolitaine et
              en France d&apos;outre-mer.
            </p>
            <p>
              Né en Martinique, Talok est la première plateforme de gestion
              locative pensée dès l&apos;origine pour les réalités{" "}
              <strong className="text-white">DROM-COM</strong> : taux de TVA
              spécifiques (8,5 % aux Antilles, 2,1 % en Guyane, 0 % à Mayotte),
              normes cycloniques, dispositifs fiscaux Pinel Outre-Mer,
              délais postaux.
            </p>
            <p>
              L&apos;application couvre tout le cycle de la gestion locative :
              rédaction de baux ALUR/ELAN, signature électronique eIDAS,
              encaissement des loyers (CB, SEPA, Open Banking), états des lieux
              numériques, comptabilité double-entrée avec export FEC,
              déclarations fiscales 2044/2072, gestion de copropriété et de
              syndic, portail locataire dédié.
            </p>
          </div>
        </section>

        {/* Logos */}
        <section className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-white mb-2">Logos & identité visuelle</h2>
          <p className="text-slate-400 mb-6 text-sm">
            Merci de ne pas modifier les couleurs, proportions ni orientations
            du logo. Couleur primaire : <code className="text-blue-300">#2563EB</code>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {LOGOS.map((logo) => (
              <div
                key={logo.label}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
              >
                <div className="p-8 flex items-center justify-center min-h-[160px]">
                  <Image
                    src={logo.src}
                    alt={logo.label}
                    width={200}
                    height={60}
                    className="max-h-20 w-auto"
                  />
                </div>
                <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-700">{logo.label}</span>
                  <a
                    href={logo.href}
                    download
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    Télécharger
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Angles éditoriaux */}
        <section className="max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-white mb-4">Angles éditoriaux suggérés</h2>
          <ul className="space-y-3 text-slate-300">
            <li className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">French Tech ultramarine :</strong>{" "}
                comment une startup née aux Antilles s&apos;attaque à un marché
                national dominé par des acteurs parisiens.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Désintermédiation des agences :</strong>{" "}
                pourquoi de plus en plus de propriétaires délaissent les
                agences (8 % de frais moyens) au profit de l&apos;autogestion.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">IA et gestion immobilière :</strong>{" "}
                comment l&apos;IA transforme la gestion locative (scoring
                candidatures, classification de documents, conseil fiscal).
              </span>
            </li>
          </ul>
        </section>

        {/* Contact presse */}
        <section id="contact-presse" className="max-w-3xl mx-auto scroll-mt-24">
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-2xl p-8 border border-blue-500/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Contact presse</h2>
                <p className="text-sm text-slate-300">
                  Interview, visuels HD, chiffres, citation fondateur — on répond.
                </p>
              </div>
            </div>
            <PressContactForm />
          </div>
        </section>
      </div>
    </div>
  );
}
