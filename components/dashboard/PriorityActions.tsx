"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/helpers/format";
import {
  Zap,
  PenTool,
  ClipboardCheck,
  Key,
  Euro,
  Bell,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Send,
  Sparkles,
  Calendar
} from "lucide-react";

interface EDLItem {
  id: string;
  type: string;
  status: string;
}

interface Lease {
  id: string;
  statut: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires?: number;
  depot_de_garantie?: number;
  date_debut: string;
  // ✅ SSOT 2026: Données pré-calculées
  has_signed_edl?: boolean;
  has_paid_initial?: boolean;
  property?: {
    id: string;
    adresse_complete?: string;
    ville?: string;
  };
  signers?: Array<{
    id: string;
    role: string;
    signature_status: string;
    invited_email?: string;
    profile?: {
      prenom?: string;
      nom?: string;
    };
  }>;
  // ✅ SOTA 2026: edl peut être un objet unique OU un tableau (legacy)
  edl?: EDLItem | EDLItem[] | null;
}

interface Invoice {
  id: string;
  lease_id: string;
  periode: string;
  montant_total: number;
  statut: string;
  due_date?: string;
}

interface PriorityActionsProps {
  leases?: Lease[];
  invoices?: Invoice[];
  className?: string;
}

interface PriorityAction {
  id: string;
  type: "sign" | "edl" | "activate" | "payment" | "relance" | "invoice";
  priority: "urgent" | "high" | "normal";
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  href?: string;
  action?: () => void;
  metadata?: {
    leaseId?: string;
    propertyName?: string;
    amount?: number;
  };
}

export function PriorityActions({ leases = [], invoices = [], className }: PriorityActionsProps) {
  // Calculer les actions prioritaires
  const actions = useMemo(() => {
    const priorityActions: PriorityAction[] = [];

    leases.forEach((lease) => {
      const propertyName = lease.property?.ville || lease.property?.adresse_complete?.split(",")[0] || "Logement";
      const mainTenant = lease.signers?.find(s => s.role === "locataire_principal");
      const ownerSigner = lease.signers?.find(s => s.role === "proprietaire");
      
      // ✅ SOTA 2026: Calcul de hasEdl compatible avec objet unique ET tableau (legacy)
      let hasEdl = false;
      // 1. Priorité: utiliser la valeur pré-calculée SSOT
      if (typeof lease.has_signed_edl === "boolean") {
        hasEdl = lease.has_signed_edl;
      }
      // 2. Fallback: edl est un objet unique (nouveau format)
      else if (lease.edl && typeof lease.edl === "object" && !Array.isArray(lease.edl)) {
        hasEdl = lease.edl.type === "entree" && (lease.edl.status === "signed" || lease.edl.status === "completed");
      }
      // 3. Fallback legacy: edl est un tableau
      else if (Array.isArray(lease.edl)) {
        hasEdl = lease.edl.some(e => e.type === "entree" && (e.status === "signed" || e.status === "completed"));
      }

      // 1. Propriétaire doit signer (locataire a signé)
      if (
        mainTenant?.signature_status === "signed" &&
        ownerSigner?.signature_status !== "signed" &&
        !["fully_signed", "active", "terminated", "archived"].includes(lease.statut)
      ) {
        priorityActions.push({
          id: `sign-${lease.id}`,
          type: "sign",
          priority: "urgent",
          title: "Signer le bail",
          description: `${propertyName} - Le locataire a signé, c'est votre tour !`,
          icon: PenTool,
          color: "blue",
          href: `/owner/leases/${lease.id}`,
          metadata: { leaseId: lease.id, propertyName }
        });
      }

      // 2. Créer EDL (bail fully_signed, pas d'EDL)
      if (lease.statut === "fully_signed" && !hasEdl) {
        priorityActions.push({
          id: `edl-${lease.id}`,
          type: "edl",
          priority: "high",
          title: "Créer l'état des lieux",
          description: `${propertyName} - Bail signé, prêt pour l'EDL d'entrée`,
          icon: ClipboardCheck,
          color: "indigo",
          href: `/owner/inspections/new?lease_id=${lease.id}&property_id=${lease.property?.id}`,
          metadata: { leaseId: lease.id, propertyName }
        });
      }

      // 3. Activer le bail (EDL signé)
      if (lease.statut === "fully_signed" && hasEdl) {
        priorityActions.push({
          id: `activate-${lease.id}`,
          type: "activate",
          priority: "high",
          title: "Activer le bail",
          description: `${propertyName} - EDL signé, prêt pour l'activation`,
          icon: Key,
          color: "green",
          href: `/owner/leases/${lease.id}`,
          metadata: { leaseId: lease.id, propertyName }
        });
      }

      // 4. Relancer le locataire (en attente depuis + de 48h)
      if (
        ["pending_signature", "sent"].includes(lease.statut) &&
        mainTenant?.signature_status !== "signed" &&
        mainTenant?.invited_email
      ) {
        priorityActions.push({
          id: `relance-${lease.id}`,
          type: "relance",
          priority: "normal",
          title: "Relancer le locataire",
          description: `${propertyName} - ${mainTenant.invited_email} n'a pas encore signé`,
          icon: Send,
          color: "amber",
          href: `/owner/leases/${lease.id}/signers`,
          metadata: { leaseId: lease.id, propertyName }
        });
      }
    });

    // 5. Factures en retard
    invoices
      .filter(inv => inv.statut === "late" || inv.statut === "sent")
      .slice(0, 3) // Max 3 factures
      .forEach((invoice) => {
        const lease = leases.find(l => l.id === invoice.lease_id);
        const propertyName = lease?.property?.ville || "Logement";
        
        if (invoice.statut === "late") {
          priorityActions.push({
            id: `invoice-late-${invoice.id}`,
            type: "payment",
            priority: "urgent",
            title: "Loyer en retard",
            description: `${propertyName} - ${formatCurrency(invoice.montant_total)} (${invoice.periode})`,
            icon: AlertTriangle,
            color: "red",
            href: `/owner/invoices/${invoice.id}`,
            metadata: { amount: invoice.montant_total, propertyName }
          });
        }
      });

    // Trier par priorité
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    return priorityActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [leases, invoices]);

  const colorConfig = {
    blue: {
      bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
      border: "border-blue-200",
      icon: "bg-blue-500",
      text: "text-blue-700",
      badge: "bg-blue-100 text-blue-700"
    },
    green: {
      bg: "bg-gradient-to-br from-green-50 to-emerald-50",
      border: "border-green-200",
      icon: "bg-green-500",
      text: "text-green-700",
      badge: "bg-green-100 text-green-700"
    },
    indigo: {
      bg: "bg-gradient-to-br from-indigo-50 to-purple-50",
      border: "border-indigo-200",
      icon: "bg-indigo-500",
      text: "text-indigo-700",
      badge: "bg-indigo-100 text-indigo-700"
    },
    amber: {
      bg: "bg-gradient-to-br from-amber-50 to-orange-50",
      border: "border-amber-200",
      icon: "bg-amber-500",
      text: "text-amber-700",
      badge: "bg-amber-100 text-amber-700"
    },
    red: {
      bg: "bg-gradient-to-br from-red-50 to-rose-50",
      border: "border-red-200",
      icon: "bg-red-500",
      text: "text-red-700",
      badge: "bg-red-100 text-red-700"
    }
  };

  if (actions.length === 0) {
    return (
      <Card className={cn("border-2 border-dashed border-green-200 bg-green-50/50", className)}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500 rounded-xl">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-green-900">Tout est à jour ! ✨</h3>
              <p className="text-sm text-green-700">Aucune action urgente à effectuer.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500 rounded-lg">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <CardTitle className="text-base">Actions prioritaires</CardTitle>
          </div>
          <Badge variant="secondary" className="font-mono">
            {actions.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          <AnimatePresence>
            {actions.slice(0, 5).map((action, index) => {
              const config = colorConfig[action.color as keyof typeof colorConfig];
              const Icon = action.icon;

              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="group"
                >
                  <Link href={action.href || "#"} className="block">
                    <div className={cn(
                      "p-4 transition-all hover:bg-slate-50",
                      action.priority === "urgent" && "bg-red-50/30"
                    )}>
                      <div className="flex items-center gap-4">
                        {/* Icône avec animation */}
                        <motion.div
                          animate={action.priority === "urgent" ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 2, repeat: Infinity }}
                          className={cn(
                            "p-2.5 rounded-xl shrink-0",
                            config.icon
                          )}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </motion.div>

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={cn("font-semibold text-sm", config.text)}>
                              {action.title}
                            </h4>
                            {action.priority === "urgent" && (
                              <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">
                                Urgent
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 truncate mt-0.5">
                            {action.description}
                          </p>
                        </div>

                        {/* Flèche */}
                        <ArrowRight className={cn(
                          "h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1",
                          config.text
                        )} />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Footer si plus d'actions */}
        {actions.length > 5 && (
          <div className="p-3 bg-slate-50 border-t text-center">
            <Link href="/owner/actions" className="text-sm text-blue-600 hover:underline font-medium">
              Voir les {actions.length - 5} autres actions →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

