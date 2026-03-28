import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { generateReceiptPDF, type ReceiptData } from "@/lib/services/receipt-generator";
import { resolveOwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";
import { getInvoiceSettlement } from "@/lib/services/invoice-status.service";
import { resolveReceiptTotalAmount } from "@/lib/services/receipt-amount";

type SupabaseLike = {
  from: (table: string) => {
    select: (...args: unknown[]) => any;
    insert: (values: Record<string, unknown>) => any;
    update?: (values: Record<string, unknown>) => any;
  };
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Uint8Array | Buffer, options?: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
      createSignedUrl?: (path: string, expiresIn: number) => Promise<{ data?: { signedUrl?: string }; error?: { message?: string } | null }>;
    };
  };
};

function normalizeDate(value?: string | null): string {
  if (!value) return new Date().toISOString().split("T")[0];
  return value.includes("T") ? value.split("T")[0] : value;
}

async function findDocumentByMetadata(
  supabase: SupabaseLike,
  type: string,
  metadataField: string,
  metadataValue: string
) {
  const { data } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("type", type)
    .filter(`metadata->>${metadataField}`, "eq", metadataValue)
    .maybeSingle();

  return data as { id?: string; storage_path?: string } | null;
}

export interface EnsureReceiptResult {
  created: boolean;
  storagePath: string;
  documentId?: string | null;
  /** PDF bytes — only present when created=true */
  pdfBytes?: Uint8Array;
  /** Tenant/payment metadata — only present when created=true */
  receiptMeta?: {
    tenantEmail: string;
    tenantName: string;
    period: string;
    totalAmount: number;
    paymentDate: string;
    paymentMethod: string;
    propertyAddress: string;
  };
}

export async function ensureReceiptDocument(
  supabase: SupabaseLike,
  paymentId: string
): Promise<EnsureReceiptResult | null> {
  const existingDoc = await findDocumentByMetadata(supabase, "quittance", "payment_id", paymentId);
  if (existingDoc?.storage_path) {
    return {
      created: false,
      storagePath: existingDoc.storage_path,
      documentId: existingDoc.id ?? null,
    };
  }

  const { data: payment } = await supabase
    .from("payments")
    .select(`
      id,
      montant,
      moyen,
      date_paiement,
      invoice:invoices!inner(
        id,
        lease_id,
        periode,
        montant_total,
        montant_loyer,
        montant_charges,
        owner_id,
        tenant_id,
        lease:leases!inner(
          id,
          property:properties!inner(
            id,
            owner_id,
            adresse_complete,
            ville,
            code_postal
          )
        )
      )
    `)
    .eq("id", paymentId)
    .single();

  const paymentData = payment as any;
  if (!paymentData?.invoice?.lease?.property) {
    return null;
  }

  const settlement = await getInvoiceSettlement(supabase as any, paymentData.invoice.id);
  if (!settlement?.isSettled) {
    return null;
  }

  const existingInvoiceDoc = await findDocumentByMetadata(
    supabase,
    "quittance",
    "invoice_id",
    paymentData.invoice.id
  );
  if (existingInvoiceDoc?.storage_path) {
    return {
      created: false,
      storagePath: existingInvoiceDoc.storage_path,
      documentId: existingInvoiceDoc.id ?? null,
    };
  }

  const ownerIdentity = await resolveOwnerIdentity(supabase as any, {
    leaseId: paymentData.invoice.lease_id,
    propertyId: paymentData.invoice.lease.property.id,
    profileId: paymentData.invoice.owner_id,
  });

  const { data: tenantProfile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, email")
    .eq("id", paymentData.invoice.tenant_id)
    .single();

  if (!tenantProfile) {
    return null;
  }

  const receiptData: ReceiptData = {
    ownerName: ownerIdentity.displayName || "Propriétaire",
    ownerAddress: ownerIdentity.billingAddress || ownerIdentity.address.street || "",
    ownerSiret: ownerIdentity.siret || undefined,
    tenantName: `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim() || "Locataire",
    propertyAddress: paymentData.invoice.lease.property.adresse_complete || "",
    propertyCity: paymentData.invoice.lease.property.ville || "",
    propertyPostalCode: paymentData.invoice.lease.property.code_postal || "",
    period: paymentData.invoice.periode,
    rentAmount: Number(paymentData.invoice.montant_loyer) || 0,
    chargesAmount: Number(paymentData.invoice.montant_charges) || 0,
    totalAmount: resolveReceiptTotalAmount(paymentData.invoice.montant_total, paymentData.montant),
    paymentDate: normalizeDate(paymentData.date_paiement),
    paymentMethod: paymentData.moyen || "cb",
    invoiceId: paymentData.invoice.id,
    paymentId: paymentData.id,
    leaseId: paymentData.invoice.lease_id,
  };

  const pdfBytes = await generateReceiptPDF(receiptData);
  const storagePath = `quittances/${paymentData.invoice.lease_id}/${paymentId}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Erreur lors du stockage de la quittance");
  }

  const { data: insertedDoc } = await supabase
    .from("documents")
    .insert({
      type: "quittance",
      category: "finance",
      title: `Quittance de loyer - ${paymentData.invoice.periode}`,
      original_filename: `quittance-${paymentData.invoice.periode}.pdf`,
      storage_path: storagePath,
      mime_type: "application/pdf",
      lease_id: paymentData.invoice.lease_id,
      tenant_id: paymentData.invoice.tenant_id,
      owner_id: paymentData.invoice.owner_id,
      property_id: paymentData.invoice.lease.property.id,
      visible_tenant: true,
      is_archived: false,
      is_generated: true,
      ged_status: "active",
      metadata: {
        invoice_id: paymentData.invoice.id,
        payment_id: paymentId,
        period: paymentData.invoice.periode,
        amount: receiptData.totalAmount,
        final: true,
      },
    })
    .select("id")
    .single();

  // Populate receipts table (idempotent, non-blocking)
  try {
    const { data: existingReceipt } = await supabase
      .from("receipts")
      .select("id")
      .eq("invoice_id", paymentData.invoice.id)
      .maybeSingle();

    if (!existingReceipt) {
      await supabase.from("receipts").insert({
        payment_id: paymentId,
        lease_id: paymentData.invoice.lease_id,
        invoice_id: paymentData.invoice.id,
        tenant_id: paymentData.invoice.tenant_id,
        owner_id: paymentData.invoice.owner_id,
        period: paymentData.invoice.periode,
        montant_loyer: receiptData.rentAmount,
        montant_charges: receiptData.chargesAmount,
        montant_total: receiptData.totalAmount,
        pdf_storage_path: storagePath,
        generated_at: new Date().toISOString(),
      });
    }
  } catch (receiptErr) {
    console.error("[Receipt] receipts table insert failed:", receiptErr);
  }

  const tenantProfileData = tenantProfile as { prenom?: string; nom?: string; email?: string } | null;

  return {
    created: true,
    storagePath,
    documentId: (insertedDoc as { id?: string } | null)?.id ?? null,
    pdfBytes,
    receiptMeta: {
      tenantEmail: tenantProfileData?.email || "",
      tenantName: receiptData.tenantName,
      period: receiptData.period,
      totalAmount: receiptData.totalAmount,
      paymentDate: receiptData.paymentDate,
      paymentMethod: receiptData.paymentMethod,
      propertyAddress: receiptData.propertyAddress,
    },
  };
}

async function buildKeyHandoverAttestationPdf(data: {
  propertyAddress: string;
  ownerName: string;
  tenantName: string;
  signedAt: string;
  keys: Array<{ type?: string; quantite?: number; quantity?: number }>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("Attestation de remise des clés", {
    x: 50,
    y: 780,
    size: 20,
    font: boldFont,
    color: rgb(0.12, 0.14, 0.22),
  });

  const lines = [
    `Bien : ${data.propertyAddress}`,
    `Propriétaire : ${data.ownerName}`,
    `Locataire : ${data.tenantName}`,
    `Date de confirmation : ${new Date(data.signedAt).toLocaleString("fr-FR")}`,
    "",
    "Clés remises :",
    ...data.keys.map((key) => `- ${key.type || "Clé"} x${key.quantite || key.quantity || 1}`),
    "",
    "Cette attestation confirme la remise des clés et la signature du locataire.",
  ];

  let y = 740;
  for (const line of lines) {
    page.drawText(line, {
      x: 50,
      y,
      size: 11,
      font,
      color: rgb(0.18, 0.2, 0.27),
    });
    y -= 22;
  }

  return pdf.save();
}

export async function ensureKeyHandoverAttestation(
  supabase: SupabaseLike,
  handoverId: string
): Promise<{ created: boolean; storagePath: string; documentId?: string | null } | null> {
  const existingDoc = await findDocumentByMetadata(
    supabase,
    "attestation_remise_cles",
    "handover_id",
    handoverId
  );
  if (existingDoc?.storage_path) {
    return {
      created: false,
      storagePath: existingDoc.storage_path,
      documentId: existingDoc.id ?? null,
    };
  }

  const { data: handover } = await supabase
    .from("key_handovers")
    .select(`
      id,
      lease_id,
      property_id,
      owner_profile_id,
      tenant_profile_id,
      keys_list,
      confirmed_at,
      lease:leases!inner(
        id,
        property:properties!inner(
          id,
          adresse_complete
        )
      )
    `)
    .eq("id", handoverId)
    .single();

  const handoverData = handover as any;
  if (!handoverData?.confirmed_at) {
    return null;
  }

  const [ownerProfile, tenantProfile] = await Promise.all([
    supabase.from("profiles").select("prenom, nom").eq("id", handoverData.owner_profile_id).single(),
    supabase.from("profiles").select("prenom, nom").eq("id", handoverData.tenant_profile_id).single(),
  ]);

  const ownerName = `${ownerProfile.data?.prenom || ""} ${ownerProfile.data?.nom || ""}`.trim() || "Propriétaire";
  const tenantName = `${tenantProfile.data?.prenom || ""} ${tenantProfile.data?.nom || ""}`.trim() || "Locataire";
  const propertyAddress = handoverData.lease?.property?.adresse_complete || "Adresse non renseignée";
  const pdfBytes = await buildKeyHandoverAttestationPdf({
    propertyAddress,
    ownerName,
    tenantName,
    signedAt: handoverData.confirmed_at,
    keys: Array.isArray(handoverData.keys_list) ? handoverData.keys_list : [],
  });

  const storagePath = `key-handover/${handoverData.lease_id}/${handoverId}/attestation.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Erreur lors du stockage de l'attestation");
  }

  const { data: insertedDoc } = await supabase
    .from("documents")
    .insert({
      type: "attestation_remise_cles",
      property_id: handoverData.property_id,
      lease_id: handoverData.lease_id,
      owner_id: handoverData.owner_profile_id,
      tenant_id: handoverData.tenant_profile_id,
      title: "Attestation de remise des clés",
      storage_path: storagePath,
      visible_tenant: true,
      is_archived: false,
      metadata: {
        handover_id: handoverId,
        confirmed_at: handoverData.confirmed_at,
        keys_count: Array.isArray(handoverData.keys_list) ? handoverData.keys_list.length : 0,
        final: true,
      },
    })
    .select("id")
    .single();

  return {
    created: true,
    storagePath,
    documentId: (insertedDoc as { id?: string } | null)?.id ?? null,
  };
}
