"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// --- Schémas de Validation ---

const createInvoiceSchema = z.object({
  lease_id: z.string().uuid(),
  periode: z.string().regex(/^\d{4}-\d{2}$/, "Format YYYY-MM requis"),
  montant_loyer: z.number().min(0),
  montant_charges: z.number().min(0),
  notes: z.string().optional(),
});

const updateInvoiceSchema = z.object({
  id: z.string().uuid(),
  statut: z.enum(["draft", "sent", "paid", "late", "cancelled"]),
  notes: z.string().optional(),
});

// --- Server Actions ---

export async function createInvoiceAction(formData: z.infer<typeof createInvoiceSchema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifié" };
  }

  // 1. Validation des données
  const validatedFields = createInvoiceSchema.safeParse(formData);
  if (!validatedFields.success) {
    return { error: "Données invalides", details: validatedFields.error.flatten() };
  }

  const { lease_id, periode, montant_loyer, montant_charges, notes } = validatedFields.data;

  // 2. Récupérer le profil utilisateur (Owner)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Profil introuvable" };

  // 3. Récupérer les infos du bail pour avoir le tenant_id
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id, 
      property_id,
      signers:lease_signers(profile_id, role)
    `)
    .eq("id", lease_id)
    .single();

  if (!lease) return { error: "Bail introuvable" };

  // Trouver le locataire principal
  const tenantSigner = lease.signers.find((s: any) => s.role === 'locataire_principal');
  const tenant_id = tenantSigner?.profile_id;

  // 4. Insertion en base
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      owner_id: profile.id,
      lease_id,
      tenant_id,
      periode,
      montant_loyer,
      montant_charges,
      montant_total: montant_loyer + montant_charges,
      statut: "draft",
      notes
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur création facture:", error);
    return { error: "Erreur lors de la création de la facture" };
  }

  // 5. Revalidation du cache Next.js
  revalidatePath("/owner/money");
  revalidatePath(`/owner/leases/${lease_id}`);

  return { success: true, invoice };
}

export async function updateInvoiceStatusAction(id: string, statut: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("invoices")
    .update({ statut, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "Impossible de mettre à jour le statut" };

  revalidatePath("/owner/money");
  revalidatePath("/tenant/payments");
  
  return { success: true };
}

export async function generateMonthlyInvoiceAction(lease_id: string, periode: string) {
  // Cette action reprend la logique de "generate-monthly" mais sans passer par l'API Route
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  // ... (Logique identique à l'API route précédente, mais sécurisée ici)
  // Pour l'instant, on fait simple :
  
  // 1. Récupérer le bail
  const { data: lease } = await supabase
    .from("leases")
    .select("id, loyer, charges_forfaitaires, property:properties(owner_id)")
    .eq("id", lease_id)
    .single();

  if (!lease) return { error: "Bail introuvable" };

  // 2. Appeler l'action de création standard
  return await createInvoiceAction({
    lease_id,
    periode,
    montant_loyer: lease.loyer || 0,
    montant_charges: lease.charges_forfaitaires || 0
  });
}

export async function sendInvoiceAction(id: string) {
  // Simuler l'envoi par email (plus tard via Resend)
  return await updateInvoiceStatusAction(id, "sent");
}
