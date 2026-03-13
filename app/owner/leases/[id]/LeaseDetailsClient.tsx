"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Edit,
  Users,
  FolderOpen,
  CreditCard,
  CheckCircle,
  RefreshCw,
  CalendarOff,
  Lock,
  FileText,
  Download,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  PenTool,
  Key,
  Euro,
  Clock,
  ArrowRight,
  MoreHorizontal,
  Eye,
  CalendarClock,
} from "lucide-react";
import { LeaseRenewalWizard } from "@/features/leases/components/lease-renewal-wizard";
import { useToast } from "@/components/ui/use-toast";
import type { LeaseDetails } from "../../_data/fetchLeaseDetails";
import { LeasePreview } from "@/features/leases/components/lease-preview";
import { formatCurrency } from "@/lib/helpers/format";
import { mapLeaseToTemplate } from "@/lib/mappers/lease-to-template";
import { OwnerSignatureModal } from "./OwnerSignatureModal";
import { dpeService } from "@/features/diagnostics/services/dpe.service";
import { useEffect } from "react";
import { LeaseProgressTracker, type LeaseProgressStatus } from "@/components/owner/leases/LeaseProgressTracker";
import { KeyHandoverQRGenerator } from "@/components/key-handover/KeyHandoverQRGenerator";
import { LeaseTimeline } from "@/components/owner/leases/LeaseTimeline";
import { Celebration, useCelebration } from "@/components/ui/celebration";
import { SignatureUsageBadge } from "@/components/subscription/signature-usage-badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeaseEdlTab } from "./tabs/LeaseEdlTab";
import { LeaseDocumentsTab } from "./tabs/LeaseDocumentsTab";
import { LeasePaymentsTab } from "./tabs/LeasePaymentsTab";
import { resolveTenantDisplay, resolveTenantFullName } from "@/lib/helpers/resolve-tenant-display";
import { LeaseDetailsSidebar } from "./LeaseDetailsSidebar";

interface LeaseDetailsClientProps {
  details: LeaseDetails;
  leaseId: string;
  ownerProfile?: {
    id: string;
    prenom: string;
    nom: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    type?: string;
    raison_sociale?: string;
    forme_juridique?: string;
    siret?: string;
  };
}

/**
 * SSOT 2026 — Config des statuts alignée avec la CHECK DB.
 * Seuls les statuts réellement écrits par l'API sont listés.
 * Migration : 20260108400000_lease_lifecycle_sota2026.sql
 */
const STATUS_CONFIG: Record<string, { label: string; color: string; description?: string }> = {
  draft: {
    label: "Brouillon",
    color: "bg-slate-100 text-slate-700 border-slate-300",
    description: "Le bail est en cours de rédaction",
  },
  pending_signature: {
    label: "Signature en attente",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    description: "En attente de toutes les signatures",
  },
  partially_signed: {
    label: "Partiellement signé",
    color: "bg-orange-100 text-orange-700 border-orange-300",
    description: "Certaines parties ont signé",
  },
  fully_signed: {
    label: "Signé - EDL requis",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
    description: "Bail entièrement signé. Un état des lieux d'entrée est requis pour activer le bail.",
  },
  active: {
    label: "Actif",
    color: "bg-green-100 text-green-700 border-green-300",
    description: "Le bail est en cours",
  },
  terminated: {
    label: "Terminé",
    color: "bg-slate-100 text-slate-600 border-slate-300",
    description: "Le bail est terminé",
  },
  archived: {
    label: "Archivé",
    color: "bg-gray-200 text-gray-600 border-gray-300",
    description: "Le bail est archivé",
  },
  cancelled: {
    label: "Annulé",
    color: "bg-red-100 text-red-600 border-red-300",
    description: "Le bail a été annulé",
  },
};

export function LeaseDetailsClient({ details, leaseId, ownerProfile }: LeaseDetailsClientProps) {
  const { lease, property, signers, payments, invoices, documents, edl } = details;
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showRenewalWizard, setShowRenewalWizard] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [dpeStatus, setDpeStatus] = useState<{ status: string; data?: any } | null>(null);
  const [isResendingTenant, setIsResendingTenant] = useState(false);
  
  // ✅ SOTA 2026: Hook de célébration
  const { celebrate, celebrationProps } = useCelebration();
  
  const [activationCheck, setActivationCheck] = useState<{
    can_activate: boolean;
    can_force_activate: boolean;
    missing_conditions: string[];
    edl?: { id: string; status: string } | null;
  } | null>(null);

  // ✅ SSOT 2026: Onglet actif — auto-switch vers EDL quand bail fully_signed
  const defaultTab = useMemo(() => {
    if (lease.statut === "fully_signed") return "edl";
    return "contrat";
  }, [lease.statut]);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleResendTenantInvite = async (signerId: string) => {
    setIsResendingTenant(true);
    try {
      const res = await fetch(`/api/leases/${leaseId}/signers/${signerId}/resend`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la relance");
      }
      toast({ title: "Invitation relancée", description: "Un nouvel email a été envoyé au locataire." });
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de relancer l'invitation.",
        variant: "destructive",
      });
    } finally {
      setIsResendingTenant(false);
    }
  };

  // Charger le statut DPE au chargement
  // Fallback : si dpe_deliverables est vide, utiliser les champs DPE de la propriété
  useEffect(() => {
    async function checkDPE() {
      try {
        const result = await dpeService.getLatestDeliverable(property.id);
        if (result.status !== "MISSING") {
          setDpeStatus(result);
          return;
        }
        // Fallback : vérifier les champs DPE stockés directement sur la propriété
        const propAny = property as any;
        const classeEnergie = propAny.dpe_classe_energie || propAny.energie;
        if (classeEnergie) {
          const isExpired = propAny.dpe_date_validite
            ? new Date(propAny.dpe_date_validite) < new Date()
            : false;
          setDpeStatus({
            status: isExpired ? "EXPIRED" : "VALID",
            data: {
              classe_energie: classeEnergie,
              classe_ges: propAny.dpe_classe_climat || propAny.ges,
              source: "property_fields",
            },
          });
        } else {
          setDpeStatus(result); // MISSING
        }
      } catch (error) {
        console.error("Erreur check DPE:", error);
        // Même en cas d'erreur, essayer le fallback propriété
        const propAny = property as any;
        const classeEnergie = propAny.dpe_classe_energie || propAny.energie;
        if (classeEnergie) {
          setDpeStatus({ status: "VALID", data: { classe_energie: classeEnergie, source: "property_fields_fallback" } });
        }
      }
    }
    checkDPE();
  }, [property]);

  const statusConfig = STATUS_CONFIG[lease.statut] || STATUS_CONFIG.draft;
  
  // ✅ FILTRAGE DES DOCUMENTS — sans dé-duplication (bug fix: tous les docs doivent être affichés)
  const leaseAnnexes = (documents || [])
    .filter((doc: any) =>
      ["diagnostic_performance", "diagnostic_amiante", "attestation_assurance", "EDL_entree", "annexe_pinel", "etat_travaux", "autre"].includes(doc.type)
    )
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Vérifier si le bail peut être activé (statut fully_signed)
  const canActivate = lease.statut === "fully_signed";
  
  // ✅ BAIL SCELLÉ : Un bail signé ne peut plus être modifié
  const isSealed = !!(lease as any).sealed_at || ["fully_signed", "active", "terminated", "archived"].includes(lease.statut);
  const signedPdfPath = (lease as any).signed_pdf_path;
  const sealedAt = (lease as any).sealed_at;

  // ✅ SYNCHRONISATION : Les données financières viennent du BIEN (source unique)
  const propAny = property as any;
  
  // Calcul du dépôt max légal selon le type de bail
  const getMaxDepotLegal = (typeBail: string, loyerHC: number): number => {
    switch (typeBail) {
      case "nu":
      case "etudiant":
        return loyerHC * 1;
      case "meuble":
      case "colocation":
        return loyerHC * 2;
      case "mobilite":
        return 0;
      case "saisonnier":
        return loyerHC * 2;
      default:
        return loyerHC;
    }
  };

  // ✅ LIRE depuis le BIEN (source unique SSOT 2026)
  const displayLoyer = lease.loyer ?? propAny?.loyer_hc ?? propAny?.loyer_base ?? 0;
  const displayCharges = lease.charges_forfaitaires ?? propAny?.charges_mensuelles ?? 0;
  const displayDepot = lease.depot_de_garantie ?? getMaxDepotLegal(lease.type_bail, displayLoyer);
  const premierVersement = displayLoyer + displayCharges + displayDepot;

  // ✅ SOTA 2026: Détection robuste des signataires (gère toutes les variantes de rôles)
  // Log de diagnostic en dev pour identifier les problèmes de données
  if (process.env.NODE_ENV === "development" && (!signers || signers.length === 0)) {
    console.warn("[LeaseDetailsClient] ⚠️ Aucun signataire trouvé pour ce bail:", leaseId);
  }
  if (process.env.NODE_ENV === "development" && signers?.length > 0) {
    console.log("[LeaseDetailsClient] Signataires:", signers.map((s: any) => ({ id: s.id, role: s.role, profile_id: s.profile?.id, invited_email: s.invited_email, status: s.signature_status })));
  }

  const mainTenant = signers?.find((s: any) => {
    const role = (s.role || '').toLowerCase();
    return role === 'locataire_principal' || role === 'locataire' || role === 'tenant' || role === 'principal';
  });
  const ownerSigner = signers?.find((s: any) => {
    const role = (s.role || '').toLowerCase();
    return role === 'proprietaire' || role === 'owner' || role === 'bailleur';
  });

  if (process.env.NODE_ENV === "development" && signers?.length > 0 && !mainTenant) {
    console.warn("[LeaseDetailsClient] ⚠️ Signataires présents mais aucun avec rôle locataire. Rôles trouvés:", signers.map((s: any) => s.role));
  }
  
  // ✅ SOTA 2026: Logique corrigée - Le propriétaire peut signer dès que le locataire a signé
  const needsOwnerSignature = useMemo(() => {
    // Si déjà fully_signed, active, ou terminé → pas besoin de signer
    if (["fully_signed", "active", "terminated", "archived"].includes(lease.statut)) {
      return false;
    }
    // Si le propriétaire a déjà signé → pas besoin
    if (ownerSigner?.signature_status === "signed") {
      return false;
    }
    // Le locataire principal doit avoir signé en premier
    return mainTenant?.signature_status === "signed";
  }, [lease.statut, mainTenant?.signature_status, ownerSigner?.signature_status]);

  // ✅ SOTA 2026: Utiliser les données pré-calculées par fetchLeaseDetails (SSOT)
  // edl est un OBJET unique (ou null), PAS un tableau !
  const hasEdl = useMemo(() => {
    // Si c'est un objet unique (nouveau format SOTA 2026)
    if (edl && typeof edl === "object" && !Array.isArray(edl)) {
      return true;
    }
    // Fallback legacy: Si c'est un tableau (ancien format)
    if (Array.isArray(edl)) {
      return edl.length > 0;
    }
    return false;
  }, [edl]);
  
  // ✅ SOTA 2026: Priorité aux données pré-calculées dans lease.has_signed_edl
  const hasSignedEdl = useMemo(() => {
    // 1. Utiliser la valeur pré-calculée par fetchLeaseDetails (SSOT)
    if (typeof (lease as any).has_signed_edl === "boolean") {
      return (lease as any).has_signed_edl;
    }
    // 2. Fallback: edl est un OBJET unique (nouveau format)
    if (edl && typeof edl === "object" && !Array.isArray(edl)) {
      return edl.status === "signed" || edl.status === "completed";
    }
    // 3. Fallback legacy: Si c'est un tableau
    if (Array.isArray(edl)) {
      const entryEdl = edl.find((e: any) => e.type === "entree");
      return entryEdl?.status === "signed" || entryEdl?.status === "completed";
    }
    return false;
  }, [lease, edl]);

  // ✅ SOTA 2026: Priorité aux données pré-calculées dans lease.has_paid_initial
  const hasPaidInitial = useMemo(() => {
    // 1. Utiliser la valeur pré-calculée par fetchLeaseDetails (SSOT)
    if (typeof (lease as any).has_paid_initial === "boolean") {
      return (lease as any).has_paid_initial;
    }
    // 2. Fallback: Vérifier les paiements
    if (!payments || payments.length === 0) return false;
    return payments.some((p: any) =>
      p.statut === "succeeded" || p.statut === "paid"
    );
  }, [lease, payments]);

  // Remise des clés confirmée
  const hasKeysHandedOver = useMemo(() => {
    if (typeof (lease as any).has_keys_handed_over === "boolean") {
      return (lease as any).has_keys_handed_over;
    }
    return false;
  }, [lease]);

  // ✅ SOTA 2026: Déterminer l'action prioritaire
  const nextAction = useMemo(() => {
    // 1. En attente de signature locataire
    if (["draft", "sent", "pending_signature"].includes(lease.statut) && mainTenant?.signature_status !== "signed") {
      return {
        type: "waiting_tenant",
        icon: Clock,
        title: "En attente du locataire",
        description: mainTenant?.invited_email 
          ? `${mainTenant.invited_email} n'a pas encore signé`
          : "Le locataire n'a pas encore signé",
        action: null,
        actionLabel: null,
        color: "amber"
      };
    }
    
    // 2. Propriétaire doit signer
    if (needsOwnerSignature) {
      return {
        type: "sign_owner",
        icon: PenTool,
        title: "À votre tour de signer !",
        description: "Le locataire a signé. Signez pour valider le bail.",
        action: () => setShowSignatureModal(true),
        actionLabel: "Signer le bail",
        color: "blue",
        urgent: true
      };
    }
    
    // 3. Bail signé, EDL requis — action contextuelle selon l'état de l'EDL
    if (lease.statut === "fully_signed" && !hasSignedEdl) {
      // 3a. Pas d'EDL → Créer
      if (!edl) {
        return {
          type: "create_edl",
          icon: ClipboardCheck,
          title: "État des lieux requis",
          description: "Le bail est signé. Lancez l'EDL d'entrée pour activer le bail.",
          href: `/owner/inspections/new?lease_id=${leaseId}&property_id=${property.id}&type=entree`,
          actionLabel: "Commencer l'état des lieux",
          color: "indigo"
        };
      }
      // 3b. EDL incomplet (brouillon, planifié, en cours) → Continuer
      if (["draft", "scheduled", "in_progress"].includes(edl.status)) {
        return {
          type: "continue_edl",
          icon: ClipboardCheck,
          title: "Compléter l'état des lieux",
          description: "Un EDL d'entrée est en cours. Complétez-le pour activer le bail.",
          href: `/owner/inspections/${edl.id}`,
          actionLabel: "Continuer l'EDL",
          color: "indigo"
        };
      }
      // 3c. EDL complété mais pas signé → Signer
      if (edl.status === "completed") {
        return {
          type: "sign_edl",
          icon: PenTool,
          title: "Signer l'état des lieux",
          description: "L'EDL est complété. Faites-le signer pour activer le bail.",
          href: `/owner/inspections/${edl.id}`,
          actionLabel: "Signer l'EDL",
          color: "indigo",
          urgent: true
        };
      }
      // 3d. Autre statut (ex: disputed) → Voir l'onglet EDL
      return {
        type: "view_edl",
        icon: ClipboardCheck,
        title: "État des lieux",
        description: "Consultez l'état des lieux d'entrée.",
        action: () => setActiveTab("edl"),
        actionLabel: "Voir l'onglet EDL",
        color: "indigo"
      };
    }
    
    // 4. EDL fait, activer le bail
    if (lease.statut === "fully_signed" && hasSignedEdl) {
      return {
        type: "activate",
        icon: Key,
        title: "Prêt à activer !",
        description: "L'EDL est signé. Activez le bail pour démarrer la location.",
        action: () => handleActivate(false),
        actionLabel: "Activer le bail",
        color: "green"
      };
    }
    
    // 5. Bail actif, premier paiement en attente
    if (lease.statut === "active" && !hasPaidInitial) {
      return {
        type: "awaiting_payment",
        icon: Euro,
        title: "En attente du 1er paiement",
        description: `${formatCurrency(premierVersement)} (loyer + charges + dépôt)`,
        action: () => setActiveTab("paiements"),
        actionLabel: "Voir les paiements",
        color: "amber"
      };
    }

    // 6. Bail actif, paiement reçu, clés pas encore remises
    if (lease.statut === "active" && hasPaidInitial && !hasKeysHandedOver) {
      return {
        type: "key_handover",
        icon: Key,
        title: "Remise des clés",
        description: "Le paiement est reçu. Procédez à la remise des clés.",
        action: () => {
          const el = document.getElementById("key-handover-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
        actionLabel: "Remettre les clés",
        color: "green"
      };
    }

    // 7. Tout est OK
    if (lease.statut === "active" && hasKeysHandedOver) {
      return {
        type: "all_done",
        icon: CheckCircle,
        title: "Bail actif",
        description: "Tout est en ordre ! Le bail est en cours.",
        action: null,
        actionLabel: null,
        color: "green"
      };
    }

    // Fallback: bail actif sans tracking de remise de clés
    if (lease.statut === "active") {
      return {
        type: "all_done",
        icon: CheckCircle,
        title: "Bail actif",
        description: "Tout est en ordre ! Le bail est en cours.",
        action: null,
        actionLabel: null,
        color: "green"
      };
    }
    
    return null;
  }, [lease.statut, mainTenant, needsOwnerSignature, hasSignedEdl, hasPaidInitial, hasKeysHandedOver, premierVersement, leaseId, property.id, edl]);

  // Construire bailData pour la prévisualisation (via mapper)
  const bailData = mapLeaseToTemplate(details, ownerProfile);

  // Signer le bail en tant que propriétaire avec image de signature
  const handleOwnerSign = async (signatureImage: string) => {
    setIsSigning(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "SES",
          signature_image: signatureImage,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la signature");
      }
      
      setShowSignatureModal(false);
      
      // 🎉 SSOT 2026: Célébration après signature réussie + switch onglet EDL
      celebrate({
        title: "Bail signé ! 🎉",
        subtitle: "Toutes les parties ont signé. Prochaine étape : l'état des lieux d'entrée.",
        type: "milestone",
        nextAction: {
          label: "Aller à l'onglet EDL",
          onClick: () => setActiveTab("edl"),
        },
      });
      
      router.refresh();
    } catch (error: unknown) {
      console.error("Erreur signature:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de signer le bail",
        variant: "destructive",
      });
      throw error; // Re-throw pour le modal
    } finally {
      setIsSigning(false);
    }
  };

  // Supprimer le bail
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la suppression");
      }
      toast({
        title: "✅ Bail supprimé",
        description: "Le bail et toutes ses données ont été supprimés.",
      });
      // ✅ SOTA 2026: Rediriger vers la page du bien pour que le CTA "Créer un bail" soit visible
      // Le revalidatePath côté API a déjà invalidé le cache ISR
      const propertyId = property?.id || result.propertyId;
      if (propertyId) {
        router.push(`/owner/properties/${propertyId}`);
      } else {
        router.push("/owner/leases");
      }
      router.refresh();
    } catch (error: unknown) {
      console.error("Erreur suppression:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer le bail",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Résilier le bail
  const handleTerminate = async () => {
    setIsTerminating(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termination_date: new Date().toISOString().split("T")[0],
          reason: "Résiliation à l'initiative du propriétaire",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la résiliation");
      }
      toast({
        title: "✅ Bail résilié",
        description: "Le bail a été terminé avec succès.",
      });
      router.refresh();
    } catch (error: unknown) {
      console.error("Erreur résiliation:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de résilier le bail",
        variant: "destructive",
      });
    } finally {
      setIsTerminating(false);
      setShowTerminateDialog(false);
    }
  };

  // Callback après renouvellement
  const handleRenewalSuccess = (newLeaseId: string) => {
    router.push(`/owner/leases/${newLeaseId}`);
    router.refresh();
  };

  // Peut-on renouveler ou résilier ?
  const canRenew = lease.statut === "active";
  const canTerminate = lease.statut === "active";

  // ===== ACTIVATION DU BAIL =====
  // Vérifier les conditions d'activation
  const checkActivation = async () => {
    try {
      const response = await fetch(`/api/leases/${leaseId}/activate`);
      const data = await response.json();
      if (response.ok) {
        setActivationCheck(data);
      }
    } catch (error) {
      console.error("Erreur vérification activation:", error);
    }
  };

  // Activer le bail
  const handleActivate = async (force = false) => {
    setIsActivating(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_without_edl: force }),
      });
      const result = await response.json();
      
      if (!response.ok) {
        // Stocker les infos de vérification pour affichage
        setActivationCheck(result);
        throw new Error(result.error || "Impossible d'activer le bail");
      }
      
      // 🎉 SOTA 2026: Grande célébration - Bail actif !
      celebrate({
        title: "Félicitations ! 🏠",
        subtitle: `Le bail est maintenant actif. La première facture de ${formatCurrency(premierVersement)} a été générée.`,
        type: "complete",
        nextAction: {
          label: "Voir les factures",
          href: `/owner/leases/${leaseId}/invoices`,
        },
      });
      
      router.refresh();
    } catch (error: unknown) {
      console.error("Erreur activation:", error);
      toast({
        title: "Action requise",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-4">
        <Breadcrumb
          items={[
            { label: "Baux & locataires", href: "/owner/leases" },
            { label: `Bail ${property.ville}` }
          ]}
          homeHref="/owner/dashboard"
        />
      </div>

      {/* Barre supérieure fixe (Header) */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/owner/leases"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground hover:text-foreground")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-slate-900 hidden sm:block">
                Bail {property.ville}
              </h1>
              <Badge className={statusConfig.color} variant="outline">
                {statusConfig.label}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* SOTA 2026: Indicateur quota signatures */}
            <SignatureUsageBadge variant="minimal" />

            {needsOwnerSignature && (
              <Button
                size="sm"
                onClick={() => setShowSignatureModal(true)}
                disabled={isSigning}
                className="bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                {isSigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Signer le bail
              </Button>
            )}
            
            {/* Bouton d'activation — grisé tant que les prérequis ne sont pas remplis */}
            {canActivate && (() => {
              const missingItems: string[] = [];
              if (!hasSignedEdl) missingItems.push("État des lieux non réalisé");
              if (dpeStatus?.status !== "VALID") missingItems.push("DPE manquant ou expiré");
              const canActivateNow = missingItems.length === 0;
              return (
                <Button
                  size="sm"
                  onClick={() => handleActivate(false)}
                  disabled={isActivating || !canActivateNow}
                  className={canActivateNow
                    ? "bg-green-600 hover:bg-green-700 shadow-sm"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none border border-slate-200"
                  }
                  title={canActivateNow
                    ? "Activer le bail"
                    : `Prérequis manquants : ${missingItems.join(", ")}`
                  }
                >
                  {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Activer le bail
                </Button>
              );
            })()}
            
            {/* Bouton Modifier ou Imprimer/PDF selon l'état */}
            {!isSealed ? (
              <Link
                href={`/owner/leases/${leaseId}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-white hover:bg-slate-50 border-slate-200")}
              >
                <Edit className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Modifier</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <a 
                  href={`/api/documents/download?path=${encodeURIComponent(signedPdfPath)}&filename=Bail_Complet_${property.ville || 'Logement'}.pdf`}
                  download
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Imprimer / PDF</span>
                  <span className="sm:hidden text-[10px]">PDF</span>
                </a>
                <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-400 font-medium uppercase tracking-wider px-2 py-1 bg-slate-50 rounded border border-slate-100">
                  <Lock className="h-3 w-3" />
                  Scellé
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* 🚀 SOTA 2026: Tracker de progression */}
        <div className="mb-6">
          <LeaseProgressTracker
            status={lease.statut as LeaseProgressStatus}
            hasSignedEdl={hasSignedEdl}
            hasPaidInitial={hasPaidInitial}
            hasKeysHandedOver={hasKeysHandedOver}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Colonne de gauche : Onglets Contrat / EDL / Documents / Paiements */}
          <div className="lg:col-span-8 xl:col-span-9 order-2 lg:order-1 flex flex-col lg:h-[calc(100vh-8rem)]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-1">
              {/* Barre d'onglets */}
              <TabsList className="w-full justify-start bg-white border border-slate-200 rounded-t-xl rounded-b-none h-12 px-2 gap-1">
                <TabsTrigger value="contrat" className="gap-2 data-[state=active]:bg-slate-100">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Contrat</span>
                </TabsTrigger>
                <TabsTrigger
                  value="edl"
                  className="gap-2 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">EDL d&apos;entrée</span>
                  {lease.statut === "fully_signed" && !hasSignedEdl && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                  )}
                  {hasSignedEdl && (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2 data-[state=active]:bg-slate-100">
                  <FolderOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Documents</span>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {documents?.length || 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="paiements"
                  className={`gap-2 data-[state=active]:bg-slate-100 ${
                    !["active", "terminated", "archived"].includes(lease.statut) ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                  disabled={!["active", "terminated", "archived"].includes(lease.statut)}
                  title={!["active", "terminated", "archived"].includes(lease.statut) ? "Disponible après activation du bail" : undefined}
                >
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Paiements</span>
                  {!["active", "terminated", "archived"].includes(lease.statut) && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-200 text-slate-400 hidden sm:inline-flex">
                      après activation
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Contenu : Contrat */}
              <TabsContent value="contrat" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[50vh] lg:h-full">
                  {isSealed && signedPdfPath ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50 to-green-50">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 rounded-full">
                            <Lock className="h-3.5 w-3.5 text-emerald-700" />
                            <span className="text-xs font-semibold text-emerald-700">Document scellé</span>
                          </div>
                          {sealedAt && (
                            <span className="text-xs text-slate-500">
                              le {new Date(sealedAt).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/documents/view?path=${encodeURIComponent(signedPdfPath)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-emerald-700 border-emerald-200 hover:bg-emerald-50")}
                          >
                            <ExternalLink className="h-4 w-4 mr-1.5" />
                            Ouvrir
                          </a>
                          <a
                            href={`/api/documents/download?path=${encodeURIComponent(signedPdfPath)}&filename=Bail_${leaseId.substring(0, 8).toUpperCase()}.html`}
                            download
                            className={cn(buttonVariants({ size: "sm" }), "bg-emerald-600 hover:bg-emerald-700")}
                          >
                            <Download className="h-4 w-4 mr-1.5" />
                            Télécharger
                          </a>
                        </div>
                      </div>
                      <iframe
                        src={`/api/documents/view?path=${encodeURIComponent(signedPdfPath)}`}
                        className="flex-1 w-full border-0"
                        title="Bail de location signé"
                      />
                      <div className="px-4 py-2 border-t bg-slate-50 text-center">
                        <p className="text-xs text-slate-500">
                          <Lock className="h-3 w-3 inline mr-1" />
                          Ce document est légalement scellé et ne peut plus être modifié.
                        </p>
                      </div>
                    </div>
                  ) : isSealed && !signedPdfPath ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-amber-50">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                          <span className="font-medium text-amber-800">PDF signé en cours de génération</span>
                        </div>
                        <span className="text-xs text-amber-600">Aperçu du contrat ci-dessous</span>
                      </div>
                      <LeasePreview typeBail={lease.type_bail as any} bailData={bailData} leaseId={leaseId} leaseStatus={lease.statut} />
                    </div>
                  ) : (
                    <LeasePreview typeBail={lease.type_bail as any} bailData={bailData} leaseId={leaseId} leaseStatus={lease.statut} />
                  )}
                </div>
              </TabsContent>

              {/* Contenu : EDL d'entrée */}
              <TabsContent value="edl" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 lg:overflow-auto p-6 pb-24 md:pb-6 lg:h-full">
                  <LeaseEdlTab
                    leaseId={leaseId}
                    propertyId={property.id}
                    leaseStatus={lease.statut}
                    edl={edl}
                    hasSignedEdl={hasSignedEdl}
                    propertyAddress={property.adresse_complete}
                    propertyCity={property.ville}
                    propertyType={property.type}
                    typeBail={lease.type_bail}
                  />
                </div>
              </TabsContent>

              {/* Contenu : Documents */}
              <TabsContent value="documents" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 lg:overflow-auto p-6 pb-24 md:pb-6 lg:h-full">
                  <LeaseDocumentsTab
                    leaseId={leaseId}
                    propertyId={property.id}
                    documents={documents || []}
                    dpeStatus={dpeStatus}
                  />
                </div>
              </TabsContent>

              {/* Contenu : Paiements */}
              <TabsContent value="paiements" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 lg:overflow-auto p-6 pb-24 md:pb-6 lg:h-full">
                  <LeasePaymentsTab
                    leaseId={leaseId}
                    payments={payments || []}
                    invoices={invoices || []}
                    leaseStatus={lease.statut}
                    tenantName={mainTenant ? (resolveTenantFullName(mainTenant) || "Locataire") : "Locataire"}
                    ownerName={ownerProfile ? `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() : ""}
                    propertyAddress={property.adresse_complete}
                    onPaymentRecorded={() => router.refresh()}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Colonne de droite : Contexte & Actions */}
          <LeaseDetailsSidebar
            leaseId={leaseId}
            lease={lease}
            property={property}
            signers={signers}
            payments={payments}
            documents={documents}
            edl={edl}
            mainTenant={mainTenant}
            nextAction={nextAction}
            hasSignedEdl={hasSignedEdl}
            hasPaidInitial={hasPaidInitial}
            hasKeysHandedOver={hasKeysHandedOver}
            displayLoyer={displayLoyer}
            displayCharges={displayCharges}
            displayDepot={displayDepot}
            premierVersement={premierVersement}
            dpeStatus={dpeStatus}
            leaseAnnexes={leaseAnnexes}
            canActivate={canActivate}
            canRenew={canRenew}
            canTerminate={canTerminate}
            isActivating={isActivating}
            isResendingTenant={isResendingTenant}
            onActivate={handleActivate}
            onResendTenantInvite={handleResendTenantInvite}
            onShowSignatureModal={() => setShowSignatureModal(true)}
            onShowRenewalWizard={() => setShowRenewalWizard(true)}
            showTerminateDialog={showTerminateDialog}
            onShowTerminateDialog={setShowTerminateDialog}
            isTerminating={isTerminating}
            onTerminate={handleTerminate}
            showDeleteDialog={showDeleteDialog}
            onShowDeleteDialog={setShowDeleteDialog}
            isDeleting={isDeleting}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Wizard de renouvellement */}
      <LeaseRenewalWizard
        leaseId={leaseId}
        open={showRenewalWizard}
        onOpenChange={setShowRenewalWizard}
        onSuccess={handleRenewalSuccess}
      />

      {/* Modal de signature propriétaire */}
      <OwnerSignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSign={handleOwnerSign}
        leaseInfo={{
          id: leaseId,
          typeBail: lease.type_bail,
          loyer: displayLoyer,
          charges: displayCharges,
          propertyAddress: property.adresse_complete || `${property.numero_rue || ""} ${property.nom_rue || ""}`.trim(),
          propertyCity: property.ville || "",
          tenantName: mainTenant ? (resolveTenantDisplay(mainTenant).isPlaceholder ? undefined : resolveTenantFullName(mainTenant)) : undefined,
          dateDebut: lease.date_debut,
        }}
        ownerName={ownerProfile ? `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() : ""}
      />

      {/* 🎉 SOTA 2026: Célébration */}
      <Celebration {...celebrationProps} />
    </div>
  );
}
