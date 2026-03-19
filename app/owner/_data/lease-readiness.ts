import {
  LEASE_DOCUMENT_TYPE_MAP,
  getLeaseDocumentUIStatus,
} from "@/lib/config/lease-document-types";
import type { LeaseStatus as DomainLeaseStatus } from "@/lib/types/status";

type LeaseStatus = DomainLeaseStatus | "sent";

type SignatureStatus = "pending" | "signed" | "refused" | "expired";
type PaymentStatus = "pending" | "succeeded" | "paid" | "failed" | "refunded";
type InvoiceStatus = "draft" | "sent" | "paid" | "late";
type EdlStatus =
  | "draft"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "signed"
  | "disputed"
  | "closed";

type ReadinessTone = "slate" | "amber" | "blue" | "indigo" | "emerald" | "red";

export interface LeaseReadinessSigner {
  id: string;
  role: string;
  signature_status: SignatureStatus;
  invited_email?: string | null;
}

export interface LeaseReadinessPayment {
  id: string;
  montant: number;
  statut: PaymentStatus;
  date_paiement?: string | null;
  invoice_id?: string | null;
}

export interface LeaseReadinessInvoice {
  id: string;
  montant_total: number;
  statut: InvoiceStatus;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  type?: string | null;
}

export interface LeaseReadinessDocument {
  id: string;
  type: string;
  storage_path: string;
  created_at: string;
  expiry_date?: string | null;
  is_archived?: boolean;
}

export interface LeaseReadinessEdl {
  id: string;
  status: EdlStatus;
}

export interface LeaseDpeStatus {
  status: "VALID" | "EXPIRED" | "MISSING";
  source: "deliverable" | "property_fields" | "none";
  data?: {
    energy_class?: string | null;
    ges_class?: string | null;
    valid_until?: string | null;
    document_path?: string | null;
  } | null;
}

export interface LeaseReadinessInput {
  lease: {
    id: string;
    statut: LeaseStatus;
    signed_pdf_path?: string | null;
    has_signed_edl?: boolean;
    has_paid_initial?: boolean;
    has_keys_handed_over?: boolean;
  };
  property: {
    id: string;
    dpe_classe_energie?: string | null;
    energie?: string | null;
    dpe_classe_climat?: string | null;
    ges?: string | null;
    dpe_date_validite?: string | null;
  };
  signers: LeaseReadinessSigner[];
  payments: LeaseReadinessPayment[];
  invoices: LeaseReadinessInvoice[];
  documents: LeaseReadinessDocument[];
  edl: LeaseReadinessEdl | null;
  dpeStatus: LeaseDpeStatus;
}

export type LeaseReadinessStep =
  | "awaiting_tenant_signature"
  | "awaiting_owner_signature"
  | "awaiting_initial_invoice"
  | "awaiting_edl"
  | "edl_in_progress"
  | "edl_signature_required"
  | "awaiting_initial_payment"
  | "partial_initial_payment"
  | "awaiting_key_handover"
  | "activation_blocked"
  | "ready_to_activate"
  | "active_stable"
  | "closed";

export interface LeaseReadinessAction {
  key:
    | "none"
    | "open_signers"
    | "resend_tenant_invite"
    | "sign_owner"
    | "create_edl"
    | "continue_edl"
    | "sign_edl"
    | "open_documents"
    | "activate_lease"
    | "open_payments"
    | "handover_keys";
  label: string | null;
  description: string;
  tone: ReadinessTone;
  href?: string;
  tab?: "contrat" | "edl" | "documents" | "paiements";
  targetId?: string;
}

export interface LeaseReadinessChecklistItem {
  key: "contract" | "dpe" | "insurance" | "edl";
  label: string;
  status: "complete" | "action_required" | "warning" | "locked";
  actionLabel?: string;
  href?: string;
  tab?: "contrat" | "edl" | "documents" | "paiements";
}

export interface LeaseWorkflowDocument {
  key: "contract" | "edl" | "dpe";
  label: string;
  status: "available" | "pending_workflow" | "expired" | "missing";
  description: string;
  storagePath?: string;
  href?: string;
  source: "workflow" | "diagnostics";
}

export interface LeaseReadinessState {
  currentStep: LeaseReadinessStep;
  hero: {
    tone: ReadinessTone;
    eyebrow: string;
    title: string;
    description: string;
    highlights: string[];
  };
  nextAction: LeaseReadinessAction;
  paymentState: {
    status:
      | "locked"
      | "invoice_pending"
      | "invoice_issued"
      | "partial"
      | "paid";
    label: string;
    description: string;
    expectedAmount: number;
    paidAmount: number;
    remainingAmount: number;
    firstInvoiceId?: string;
  };
  documentState: {
    contract: "available" | "pending_workflow" | "missing";
    edl: "available" | "pending_workflow" | "in_progress" | "missing";
    dpe: "available" | "expired" | "missing";
    insurance: "available" | "expired" | "missing";
    completedCount: number;
    totalCount: number;
  };
  edlState: {
    status:
      | "locked"
      | "missing"
      | "in_progress"
      | "awaiting_signature"
      | "signed";
    label: string;
    description: string;
    href?: string;
  };
  canActivate: boolean;
  blockingReasons: string[];
  checklist: LeaseReadinessChecklistItem[];
  workflowDocuments: LeaseWorkflowDocument[];
  tabs: {
    defaultTab: "contrat" | "edl" | "documents" | "paiements";
    paymentsEnabled: boolean;
    paymentsHint?: string;
  };
}

const TENANT_ROLES = new Set([
  "locataire_principal",
  "locataire",
  "tenant",
  "principal",
]);

const OWNER_ROLES = new Set(["proprietaire", "owner", "bailleur"]);
const SIGNED_LEASE_STATUSES = new Set([
  "fully_signed",
  "active",
  "notice_given",
  "terminated",
  "archived",
]);
const FINANCIAL_READY_STATUSES = new Set([
  "fully_signed",
  "active",
  "notice_given",
  "terminated",
  "archived",
]);

function getLatestActiveDocument(
  documents: LeaseReadinessDocument[],
  type: string
): LeaseReadinessDocument | null {
  return (
    [...documents]
      .filter((doc) => doc.type === type && !doc.is_archived)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0] ?? null
  );
}

function getInsuranceStatus(documents: LeaseReadinessDocument[]) {
  const insuranceDoc = getLatestActiveDocument(documents, "attestation_assurance");
  if (!insuranceDoc) return "missing" as const;

  const config = LEASE_DOCUMENT_TYPE_MAP.attestation_assurance;
  const uiStatus = getLeaseDocumentUIStatus(insuranceDoc, config);
  return uiStatus === "expired" ? ("expired" as const) : ("available" as const);
}

function resolveMainTenant(signers: LeaseReadinessSigner[]) {
  return signers.find((signer) => TENANT_ROLES.has(signer.role.toLowerCase()));
}

function resolveOwnerSigner(signers: LeaseReadinessSigner[]) {
  return signers.find((signer) => OWNER_ROLES.has(signer.role.toLowerCase()));
}

function resolveFirstInvoice(invoices: LeaseReadinessInvoice[]) {
  const initialInvoice =
    invoices.find(
      (invoice) =>
        invoice.metadata?.type === "initial_invoice" ||
        invoice.type === "initial_invoice"
    ) ??
    null;

  if (initialInvoice) return initialInvoice;

  return (
    [...invoices].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0] ?? null
  );
}

export function deriveServerDpeStatus(property: LeaseReadinessInput["property"], deliverable?: {
  valid_until?: string | null;
  energy_class?: string | null;
  ges_class?: string | null;
  pdf_path?: string | null;
} | null): LeaseDpeStatus {
  if (deliverable) {
    const today = new Date().toISOString().slice(0, 10);
    const isExpired = Boolean(
      deliverable.valid_until && deliverable.valid_until < today
    );

    return {
      status: isExpired ? "EXPIRED" : "VALID",
      source: "deliverable",
      data: {
        energy_class: deliverable.energy_class ?? null,
        ges_class: deliverable.ges_class ?? null,
        valid_until: deliverable.valid_until ?? null,
        document_path: deliverable.pdf_path ?? null,
      },
    };
  }

  const energyClass = property.dpe_classe_energie ?? property.energie ?? null;
  if (!energyClass) {
    return { status: "MISSING", source: "none", data: null };
  }

  const isExpired = Boolean(
    property.dpe_date_validite &&
      new Date(property.dpe_date_validite) < new Date()
  );

  return {
    status: isExpired ? "EXPIRED" : "VALID",
    source: "property_fields",
    data: {
      energy_class: energyClass,
      ges_class: property.dpe_classe_climat ?? property.ges ?? null,
      valid_until: property.dpe_date_validite ?? null,
      document_path: null,
    },
  };
}

export function deriveLeaseReadinessState(
  input: LeaseReadinessInput
): LeaseReadinessState {
  const { lease, property, signers, payments, invoices, documents, edl, dpeStatus } =
    input;

  const mainTenant = resolveMainTenant(signers);
  const ownerSigner = resolveOwnerSigner(signers);
  const financialReady = FINANCIAL_READY_STATUSES.has(lease.statut);
  const isLeaseSigned = SIGNED_LEASE_STATUSES.has(lease.statut);
  const hasSignedEdl = Boolean(lease.has_signed_edl) || edl?.status === "signed";
  const hasKeysHandedOver = Boolean(lease.has_keys_handed_over);
  const hasContractDocument =
    Boolean(getLatestActiveDocument(documents, "bail")) ||
    Boolean(lease.signed_pdf_path);
  const insuranceStatus = getInsuranceStatus(documents);

  const contractState = hasContractDocument
    ? ("available" as const)
    : isLeaseSigned
      ? ("missing" as const)
      : ("pending_workflow" as const);

  const edlDocumentState = hasSignedEdl
    ? ("available" as const)
    : edl
      ? ("in_progress" as const)
      : isLeaseSigned
        ? ("pending_workflow" as const)
        : ("missing" as const);

  const dpeDocumentState =
    dpeStatus.status === "VALID"
      ? ("available" as const)
      : dpeStatus.status === "EXPIRED"
        ? ("expired" as const)
        : ("missing" as const);

  const firstInvoice = resolveFirstInvoice(invoices);
  const successfulPayments = payments.filter(
    (payment) => payment.statut === "succeeded" || payment.statut === "paid"
  );
  const pendingPayments = payments.filter((payment) => payment.statut === "pending");
  const firstInvoicePayments = firstInvoice
    ? payments.filter((payment) => payment.invoice_id === firstInvoice.id)
    : [];
  const firstInvoiceSuccessfulAmount =
    firstInvoicePayments.length > 0
      ? firstInvoicePayments
          .filter(
            (payment) =>
              payment.statut === "succeeded" || payment.statut === "paid"
          )
          .reduce((sum, payment) => sum + payment.montant, 0)
      : successfulPayments.reduce((sum, payment) => sum + payment.montant, 0);
  const expectedAmount = firstInvoice?.montant_total ?? 0;
  const isFirstInvoicePaid =
    Boolean(lease.has_paid_initial) ||
    Boolean(firstInvoice && firstInvoice.statut === "paid") ||
    (expectedAmount > 0 && firstInvoiceSuccessfulAmount >= expectedAmount);

  let paymentState: LeaseReadinessState["paymentState"];
  if (!financialReady) {
    paymentState = {
      status: "locked",
      label: "Paiements verrouillés",
      description:
        "La première facture sera pilotée à partir de la signature complète du bail.",
      expectedAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
    };
  } else if (!firstInvoice) {
    paymentState = {
      status: "invoice_pending",
      label: "Facture initiale en attente",
      description:
        "Le bail est prêt côté workflow, mais aucune facture initiale n'est encore visible.",
      expectedAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
    };
  } else if (isFirstInvoicePaid) {
    paymentState = {
      status: "paid",
      label: "Premier paiement reçu",
      description:
        "La facture initiale est soldée. Vous pouvez passer à la remise des clés.",
      expectedAmount,
      paidAmount: Math.max(firstInvoiceSuccessfulAmount, expectedAmount),
      remainingAmount: 0,
      firstInvoiceId: firstInvoice.id,
    };
  } else if (firstInvoiceSuccessfulAmount > 0 || pendingPayments.length > 0) {
    const paidAmount = firstInvoiceSuccessfulAmount;
    paymentState = {
      status: "partial",
      label: "Paiement en cours",
      description:
        paidAmount > 0
          ? "Une partie de la facture initiale a été encaissée."
          : "Un paiement est en cours de traitement sur la facture initiale.",
      expectedAmount,
      paidAmount,
      remainingAmount: Math.max(expectedAmount - paidAmount, 0),
      firstInvoiceId: firstInvoice.id,
    };
  } else {
    paymentState = {
      status: "invoice_issued",
      label: "Paiement attendu",
      description:
        "La facture initiale est générée et attend le règlement du locataire.",
      expectedAmount,
      paidAmount: 0,
      remainingAmount: expectedAmount,
      firstInvoiceId: firstInvoice.id,
    };
  }

  let edlState: LeaseReadinessState["edlState"];
  if (!isLeaseSigned) {
    edlState = {
      status: "locked",
      label: "EDL verrouillé",
      description:
        "L'état des lieux d'entrée se débloque une fois le bail signé par toutes les parties.",
    };
  } else if (!edl) {
    edlState = {
      status: "missing",
      label: "EDL à lancer",
      description:
        "Aucun état des lieux d'entrée n'est encore ouvert pour ce bail.",
      href: `/owner/inspections/new?lease_id=${lease.id}&property_id=${property.id}&type=entree`,
    };
  } else if (["draft", "scheduled", "in_progress"].includes(edl.status)) {
    edlState = {
      status: "in_progress",
      label: "EDL en cours",
      description:
        "L'état des lieux existe mais n'est pas encore finalisé ni signé.",
      href: `/owner/inspections/${edl.id}`,
    };
  } else if (edl.status === "completed") {
    edlState = {
      status: "awaiting_signature",
      label: "Signature EDL requise",
      description:
        "L'état des lieux est complété et attend encore les signatures finales.",
      href: `/owner/inspections/${edl.id}`,
    };
  } else {
    edlState = {
      status: "signed",
      label: "EDL signé",
      description:
        "L'état des lieux d'entrée est signé et cohérent avec l'activation du bail.",
      href: edl ? `/owner/inspections/${edl.id}` : undefined,
    };
  }

  const blockingReasons: string[] = [];
  if (!isLeaseSigned) blockingReasons.push("Le bail n'est pas encore signé par toutes les parties.");
  if (paymentState.status === "invoice_pending" && lease.statut === "fully_signed") {
    blockingReasons.push("La facture initiale n'a pas encore été générée.");
  }
  if (edlState.status !== "signed" && lease.statut === "fully_signed") {
    blockingReasons.push("L'état des lieux d'entrée n'est pas encore signé.");
  }
  if (
    lease.statut === "fully_signed" &&
    paymentState.status !== "locked" &&
    paymentState.status !== "invoice_pending" &&
    paymentState.status !== "paid"
  ) {
    blockingReasons.push("Le paiement initial n'est pas encore confirmé.");
  }
  if (
    lease.statut === "fully_signed" &&
    paymentState.status === "paid" &&
    !hasKeysHandedOver
  ) {
    blockingReasons.push("La remise des clés n'est pas encore confirmée.");
  }
  if (dpeDocumentState !== "available") {
    blockingReasons.push(
      dpeDocumentState === "expired"
        ? "Le DPE est expiré."
        : "Le DPE est manquant."
    );
  }

  const canActivate =
    lease.statut === "fully_signed" &&
    edlState.status === "signed" &&
    paymentState.status === "paid" &&
    hasKeysHandedOver &&
    dpeDocumentState === "available";

  const workflowDocuments: LeaseWorkflowDocument[] = [
    {
      key: "contract",
      label: "Contrat de bail",
      status:
        contractState === "available"
          ? "available"
          : "pending_workflow",
      description:
        contractState === "available"
          ? "Le contrat principal est disponible dans le workflow du bail."
          : contractState === "missing"
            ? "Le document PDF du contrat signé n'a pas encore été généré."
            : "Le contrat PDF final sera généré une fois la signature terminée.",
      storagePath: lease.signed_pdf_path ?? undefined,
      source: "workflow",
    },
    {
      key: "edl",
      label: "État des lieux d'entrée",
      status:
        edlState.status === "signed"
          ? "available"
          : edlState.status === "awaiting_signature" ||
              edlState.status === "in_progress"
            ? "pending_workflow"
            : edlState.status === "locked"
              ? "pending_workflow"
              : "missing",
      description:
        edlState.status === "signed"
          ? "L'EDL signé est déjà porté par le workflow d'entrée."
          : "Le document final sera produit au moment de la signature de l'EDL.",
      href: edl?.id ? `/owner/inspections/${edl.id}` : edlState.href,
      source: "workflow",
    },
  ];

  if (dpeStatus.status !== "MISSING") {
    workflowDocuments.push({
      key: "dpe",
      label: "Diagnostic de performance énergétique",
      status: dpeStatus.status === "VALID" ? "available" : "expired",
      description:
        dpeStatus.status === "VALID"
          ? "Le DPE est déjà disponible dans le module diagnostics."
          : "Le DPE existe mais doit être renouvelé avant activation.",
      storagePath: dpeStatus.data?.document_path ?? undefined,
      href: `/owner/properties/${property.id}/diagnostics`,
      source: "diagnostics",
    });
  }

  const checklist: LeaseReadinessChecklistItem[] = [
    {
      key: "contract",
      label:
        contractState === "available"
          ? "Contrat principal disponible"
          : contractState === "missing"
            ? "Document contrat non généré"
            : "Contrat en attente du workflow de signature",
      status:
        contractState === "available"
          ? "complete"
          : contractState === "pending_workflow"
            ? "locked"
            : "action_required",
      tab: "contrat",
    },
    {
      key: "dpe",
      label:
        dpeDocumentState === "available"
          ? "DPE conforme"
          : dpeDocumentState === "expired"
            ? "DPE expiré"
            : "DPE manquant",
      status:
        dpeDocumentState === "available"
          ? "complete"
          : "action_required",
      actionLabel: dpeDocumentState === "available" ? undefined : "Régulariser",
      href: `/owner/properties/${property.id}/diagnostics`,
    },
    {
      key: "insurance",
      label:
        insuranceStatus === "available"
          ? "Assurance habitation reçue"
          : insuranceStatus === "expired"
            ? "Assurance habitation expirée"
            : "Assurance habitation à collecter",
      status:
        insuranceStatus === "available"
          ? "complete"
          : insuranceStatus === "expired"
            ? "warning"
            : "action_required",
      actionLabel:
        insuranceStatus === "available" ? undefined : "Voir les documents",
      tab: "documents",
    },
    {
      key: "edl",
      label: edlState.label,
      status:
        edlState.status === "signed"
          ? "complete"
          : edlState.status === "locked"
            ? "locked"
            : "action_required",
      actionLabel:
        edlState.status === "missing"
          ? "Créer"
          : edlState.status === "in_progress"
            ? "Continuer"
            : edlState.status === "awaiting_signature"
              ? "Signer"
              : undefined,
      href: edlState.href,
      tab: "edl",
    },
  ];

  const contractHighlight = mainTenant?.invited_email
    ? `Locataire: ${mainTenant.invited_email}`
    : "Signature locataire à suivre";

  let currentStep: LeaseReadinessStep;
  let hero: LeaseReadinessState["hero"];
  let nextAction: LeaseReadinessAction;
  let defaultTab: LeaseReadinessState["tabs"]["defaultTab"] = "contrat";

  const tenantSigned = mainTenant?.signature_status === "signed";
  const ownerSigned = ownerSigner?.signature_status === "signed";

  if (!tenantSigned) {
    currentStep = "awaiting_tenant_signature";
    hero = {
      tone: "amber",
      eyebrow: "Étape 1",
      title: "Le bail attend la signature du locataire",
      description:
        "Le workflow est bloqué tant que le locataire principal n'a pas signé le contrat.",
      highlights: [contractHighlight, "Le contrat final sera généré après la dernière signature"],
    };
    nextAction = mainTenant?.id
      ? {
          key: "resend_tenant_invite",
          label: "Relancer l'invitation",
          description:
            "Renvoie un email de signature au locataire principal.",
          tone: "amber",
          targetId: mainTenant.id,
        }
      : {
          key: "open_signers",
          label: "Inviter un locataire",
          description:
            "Ajoutez le locataire principal pour débloquer le workflow de signature.",
          tone: "amber",
          href: `/owner/leases/${lease.id}/signers`,
        };
  } else if (!ownerSigned && !isLeaseSigned) {
    currentStep = "awaiting_owner_signature";
    hero = {
      tone: "blue",
      eyebrow: "Étape 2",
      title: "Votre signature est maintenant requise",
      description:
        "Le locataire a signé. Une seule action reste pour verrouiller le contrat.",
      highlights: ["Une fois signé, l'EDL devient la priorité", "Le contrat final sera scellé automatiquement"],
    };
    nextAction = {
      key: "sign_owner",
      label: "Signer le bail",
      description: "Signez le bail pour passer à l'état des lieux.",
      tone: "blue",
    };
  } else if (
    lease.statut === "fully_signed" &&
    paymentState.status === "invoice_pending"
  ) {
    currentStep = "awaiting_initial_invoice";
    defaultTab = "paiements";
    hero = {
      tone: "amber",
      eyebrow: "Étape 3",
      title: "La facture initiale est en cours de préparation",
      description:
        "Le bail est signé. La prochaine brique métier attendue est la facture initiale qui servira de référence pour le premier règlement.",
      highlights: [
        "La facture initiale doit exister avant le suivi du paiement",
        "Le reste du workflow d'entrée dépend de cette facture",
      ],
    };
    nextAction = {
      key: "open_payments",
      label: "Ouvrir les paiements",
      description: "Consulte l'apparition de la facture initiale.",
      tone: "amber",
      tab: "paiements",
    };
  } else if (lease.statut === "fully_signed" && edlState.status === "missing") {
    currentStep = "awaiting_edl";
    defaultTab = "edl";
    hero = {
      tone: "indigo",
      eyebrow: "Étape 4",
      title: "L'état des lieux d'entrée doit être lancé",
      description:
        "La facture initiale existe. L'étape suivante consiste à documenter l'entrée dans le logement via un EDL simple et signé.",
      highlights: [
        "L'EDL doit être signé avant la remise des clés",
        "Le document final EDL sera généré au moment de la signature",
      ],
    };
    nextAction = {
      key: "create_edl",
      label: "Commencer l'EDL",
      description: "Ouvre la création de l'état des lieux d'entrée.",
      tone: "indigo",
      href: edlState.href,
    };
  } else if (lease.statut === "fully_signed" && edlState.status === "in_progress") {
    currentStep = "edl_in_progress";
    defaultTab = "edl";
    hero = {
      tone: "indigo",
      eyebrow: "Étape 4",
      title: "L'état des lieux est en cours",
      description:
        "Le dossier progresse, mais l'EDL n'est pas encore finalisé ni signé.",
      highlights: ["Complétez l'inspection pièce par pièce", "Les faux manquants documentaires sont masqués tant que l'EDL n'est pas signé"],
    };
    nextAction = {
      key: "continue_edl",
      label: "Continuer l'EDL",
      description: "Reprend l'état des lieux là où il a été laissé.",
      tone: "indigo",
      href: edlState.href,
    };
  } else if (
    lease.statut === "fully_signed" &&
    edlState.status === "awaiting_signature"
  ) {
    currentStep = "edl_signature_required";
    defaultTab = "edl";
    hero = {
      tone: "indigo",
      eyebrow: "Étape 4",
      title: "L'EDL est prêt mais attend encore les signatures",
      description:
        "Le contenu de l'état des lieux est finalisé. Il reste à le signer pour débloquer le règlement puis l'activation.",
      highlights: [
        "Le contrat et la facture initiale sont déjà prêts",
        "L'activation restera bloquée tant que le paiement et la remise des clés ne sont pas confirmés",
      ],
    };
    nextAction = {
      key: "sign_edl",
      label: "Signer l'EDL",
      description: "Finalise l'état des lieux d'entrée.",
      tone: "indigo",
      href: edlState.href,
    };
  } else if (
    lease.statut === "fully_signed" &&
    paymentState.status === "invoice_issued"
  ) {
    currentStep = "awaiting_initial_payment";
    defaultTab = "paiements";
    hero = {
      tone: "amber",
      eyebrow: "Étape 5",
      title: "Le paiement initial est attendu",
      description:
        "La facture initiale et l'EDL sont prêts. Le prochain jalon est maintenant le règlement du premier encaissement.",
      highlights: [
        paymentState.expectedAmount > 0
          ? `Montant attendu: ${paymentState.expectedAmount.toFixed(2)} EUR`
          : "Montant à confirmer dans la facture initiale",
        "La remise des clés ne doit être lancée qu'après confirmation du paiement",
      ],
    };
    nextAction = {
      key: "open_payments",
      label: "Suivre le paiement",
      description: "Ouvre la facture initiale et les encaissements associés.",
      tone: "amber",
      tab: "paiements",
    };
  } else if (lease.statut === "fully_signed" && paymentState.status === "partial") {
    currentStep = "partial_initial_payment";
    defaultTab = "paiements";
    hero = {
      tone: "amber",
      eyebrow: "Étape 5",
      title: "Le paiement initial est partiellement reçu",
      description:
        "Le premier règlement progresse, mais il n'est pas encore totalement soldé.",
      highlights: [
        `Déjà reçu: ${paymentState.paidAmount.toFixed(2)} EUR`,
        `Reste à encaisser: ${paymentState.remainingAmount.toFixed(2)} EUR`,
      ],
    };
    nextAction = {
      key: "open_payments",
      label: "Voir le détail",
      description: "Ouvre la facture initiale et les paiements partiels.",
      tone: "amber",
      tab: "paiements",
    };
  } else if (
    lease.statut === "fully_signed" &&
    paymentState.status === "paid" &&
    !hasKeysHandedOver
  ) {
    currentStep = "awaiting_key_handover";
    hero = {
      tone: "emerald",
      eyebrow: "Étape 6",
      title: "Le paiement est reçu, il reste la remise des clés",
      description:
        "Le dossier financier est soldé. La dernière étape opérationnelle avant activation est la confirmation de la remise des clés.",
      highlights: [
        "Le bail restera en fully_signed tant que les clés ne sont pas remises",
        "L'activation sera disponible juste après la confirmation de remise des clés",
      ],
    };
    nextAction = {
      key: "handover_keys",
      label: "Aller à la remise des clés",
      description: "Fait défiler jusqu'au module de remise des clés.",
      tone: "emerald",
    };
  } else if (lease.statut === "fully_signed" && !canActivate) {
    currentStep = "activation_blocked";
    defaultTab = dpeDocumentState === "available" ? "paiements" : "documents";
    hero = {
      tone: "amber",
      eyebrow: "Étape 7",
      title: "Le bail est presque activable",
      description:
        "Le flux principal est presque terminé, mais un blocage métier ou documentaire subsiste encore avant l'activation.",
      highlights: blockingReasons,
    };
    nextAction = {
      key: "open_documents",
      label: "Voir les blocages",
      description: "Ouvre les documents et diagnostics à régulariser.",
      tone: "amber",
      tab: "documents",
    };
  } else if (canActivate) {
    currentStep = "ready_to_activate";
    hero = {
      tone: "emerald",
      eyebrow: "Étape 7",
      title: "Tout est prêt pour activer le bail",
      description:
        "Contrat, facture initiale, EDL, paiement, remise des clés et diagnostics racontent enfin la même histoire. Vous pouvez activer le bail.",
      highlights: [
        "Le premier paiement est soldé",
        "La remise des clés est déjà confirmée",
      ],
    };
    nextAction = {
      key: "activate_lease",
      label: "Activer le bail",
      description: "Active le bail et bascule sur le suivi financier.",
      tone: "emerald",
    };
  } else if (
    lease.statut === "active" &&
    paymentState.status === "invoice_pending"
  ) {
    currentStep = "awaiting_initial_invoice";
    defaultTab = "paiements";
    hero = {
      tone: "amber",
      eyebrow: "Bail actif",
      title: "Le bail est actif mais la facture initiale manque",
      description:
        "L'activation est passée, mais le suivi financier n'est pas encore matérialisé par une facture.",
      highlights: ["Vérifiez la comptabilité du bail", "Aucun encaissement initial n'est encore visible"],
    };
    nextAction = {
      key: "open_payments",
      label: "Ouvrir les paiements",
      description: "Consulte le suivi de la facture initiale.",
      tone: "amber",
      tab: "paiements",
    };
  } else if (
    lease.statut === "active" &&
    paymentState.status === "invoice_issued"
  ) {
    currentStep = "awaiting_initial_payment";
    defaultTab = "paiements";
    hero = {
      tone: "amber",
      eyebrow: "Bail actif",
      title: "Le premier paiement est attendu",
      description:
        "La facture initiale existe bien. L'étape suivante est maintenant l'encaissement.",
      highlights: [
        paymentState.expectedAmount > 0
          ? `Montant attendu: ${paymentState.expectedAmount.toFixed(2)} EUR`
          : "Montant à confirmer dans la facture initiale",
        "Les paiements affichés s'appuient d'abord sur la facture puis sur les encaissements",
      ],
    };
    nextAction = {
      key: "open_payments",
      label: "Suivre le paiement",
      description: "Ouvre la facture initiale et les encaissements associés.",
      tone: "amber",
      tab: "paiements",
    };
  } else if (lease.statut === "active" && paymentState.status === "partial") {
    currentStep = "partial_initial_payment";
    defaultTab = "paiements";
    hero = {
      tone: "amber",
      eyebrow: "Bail actif",
      title: "Le premier paiement est partiellement reçu",
      description:
        "La facture initiale avance, mais elle n'est pas encore totalement soldée.",
      highlights: [
        `Déjà reçu: ${paymentState.paidAmount.toFixed(2)} EUR`,
        `Reste à encaisser: ${paymentState.remainingAmount.toFixed(2)} EUR`,
      ],
    };
    nextAction = {
      key: "open_payments",
      label: "Voir le détail",
      description: "Ouvre la facture initiale et les paiements partiels.",
      tone: "amber",
      tab: "paiements",
    };
  } else if (
    lease.statut === "active" &&
    paymentState.status === "paid" &&
    !hasKeysHandedOver
  ) {
    currentStep = "awaiting_key_handover";
    hero = {
      tone: "emerald",
      eyebrow: "Bail actif",
      title: "Le paiement est reçu, il reste la remise des clés",
      description:
        "Le dossier financier est soldé, mais la remise des clés n'est pas encore confirmée côté workflow.",
      highlights: ["Le bail est déjà actif", "Le QR de remise des clés devient l'action utile"],
    };
    nextAction = {
      key: "handover_keys",
      label: "Aller à la remise des clés",
      description: "Fait défiler jusqu'au module de remise des clés.",
      tone: "emerald",
    };
  } else if (["terminated", "archived", "notice_given"].includes(lease.statut)) {
    currentStep = "closed";
    hero = {
      tone: "slate",
      eyebrow: "Archive",
      title: "Ce bail n'est plus dans son cycle d'entrée",
      description:
        "La page reste cohérente, mais le bail est sorti de son workflow d'activation initial.",
      highlights: ["Les documents et paiements restent consultables", "Aucune action prioritaire n'est attendue"],
    };
    nextAction = {
      key: "none",
      label: null,
      description: "Aucune action prioritaire.",
      tone: "slate",
    };
  } else {
    currentStep = "active_stable";
    hero = {
      tone: "emerald",
      eyebrow: "Bail stabilisé",
      title: "Le bail est actif et cohérent",
      description:
        "Le contrat, les documents, l'EDL et les paiements sont alignés sur le même état métier.",
      highlights: ["Le workflow d'entrée est terminé", "Le suivi courant prend le relais"],
    };
    nextAction = {
      key: "none",
      label: null,
      description: "Aucune action prioritaire.",
      tone: "emerald",
    };
  }

  const completedCount = [
    contractState === "available",
    edlDocumentState === "available",
    dpeDocumentState === "available",
    insuranceStatus === "available",
  ].filter(Boolean).length;

  return {
    currentStep,
    hero,
    nextAction,
    paymentState,
    documentState: {
      contract: contractState,
      edl: edlDocumentState,
      dpe: dpeDocumentState,
      insurance: insuranceStatus,
      completedCount,
      totalCount: 4,
    },
    edlState,
    canActivate,
    blockingReasons,
    checklist,
    workflowDocuments,
    tabs: {
      defaultTab,
      paymentsEnabled: financialReady,
      paymentsHint: financialReady
        ? undefined
        : "Disponible après la signature complète du bail",
    },
  };
}
