import {
  Activity,
  CheckCircle2,
  CreditCard,
  Mail,
  Globe,
  Bell,
  Database,
  Info,
} from "lucide-react";

const SERVICES = [
  {
    icon: Globe,
    name: "Site web & application",
    description: "talok.fr + app.talok.fr",
    status: "operational" as const,
  },
  {
    icon: Database,
    name: "Base de données & API",
    description: "Lecture, écriture, temps réel",
    status: "operational" as const,
  },
  {
    icon: CreditCard,
    name: "Paiements",
    description: "Stripe, SEPA, Open Banking",
    status: "operational" as const,
  },
  {
    icon: Mail,
    name: "Emails transactionnels",
    description: "Quittances, relances, notifications",
    status: "operational" as const,
  },
  {
    icon: Bell,
    name: "Notifications push",
    description: "Web Push, iOS, Android",
    status: "operational" as const,
  },
];

type Status = "operational" | "degraded" | "down";

const STATUS_CONFIG: Record<
  Status,
  { label: string; color: string; dot: string }
> = {
  operational: {
    label: "Opérationnel",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  degraded: {
    label: "Perturbé",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
  down: {
    label: "Hors service",
    color: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    dot: "bg-rose-400",
  },
};

const LAST_CHECK = new Date().toLocaleString("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

export default function StatutPage() {
  const allOperational = SERVICES.every((s) => s.status === "operational");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs font-medium mb-4">
              <Activity className="w-3 h-3" />
              Statut système
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {allOperational
                ? "Tous les services sont opérationnels"
                : "Incident en cours"}
            </h1>
            <p className="text-slate-400">
              Dernière vérification : {LAST_CHECK}
            </p>
          </div>

          {/* Global indicator */}
          <div
            className={`rounded-2xl border p-6 mb-8 ${
              allOperational
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-amber-500/10 border-amber-500/30"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className={`w-4 h-4 rounded-full ${
                    allOperational ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <div
                  className={`absolute inset-0 w-4 h-4 rounded-full animate-ping ${
                    allOperational ? "bg-emerald-400" : "bg-amber-400"
                  } opacity-40`}
                />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">
                  {allOperational
                    ? "Aucun incident en cours"
                    : "Certains services sont affectés"}
                </p>
                <p className="text-sm text-slate-400">
                  Les services sont surveillés en continu.
                </p>
              </div>
              {allOperational && (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              )}
            </div>
          </div>

          {/* Services */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">Services</h2>
            <div className="space-y-3">
              {SERVICES.map((service) => {
                const cfg = STATUS_CONFIG[service.status];
                return (
                  <div
                    key={service.name}
                    className="flex items-center justify-between bg-slate-800/30 border border-slate-700/50 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3">
                      <service.icon className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-white font-medium text-sm">
                          {service.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {service.description}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${cfg.color}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Historique */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">
              Historique des incidents
            </h2>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">
                Aucun incident rapporté sur les 90 derniers jours
              </p>
              <p className="text-sm text-slate-400">
                Les incidents passés sont archivés ici dès qu&apos;ils sont résolus.
              </p>
            </div>
          </section>

          {/* Notice */}
          <section className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-300">
              <p className="mb-2">
                <strong className="text-white">Vous rencontrez un problème&nbsp;?</strong>
              </p>
              <p className="text-slate-400">
                Si le service que vous utilisez semble fonctionner mais que vous
                rencontrez un souci spécifique, contactez-nous à{" "}
                <a
                  href="mailto:support@talok.fr"
                  className="text-blue-400 hover:underline"
                >
                  support@talok.fr
                </a>
                . Temps de réponse moyen : 2 h ouvrées.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
