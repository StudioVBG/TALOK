"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  meterSchemaV3,
  diagnosticSchemaV3,
  equipmentSchemaV3,
} from "@/lib/validations/property-v3";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================
// Helper: Verify property ownership
// ============================================

async function verifyPropertyOwnership(propertyId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Non authentifié" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { error: "Accès refusé" };
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", propertyId)
    .eq("owner_id", profile.id)
    .single();

  if (!property) {
    return { error: "Bien introuvable" };
  }

  return { supabase, profileId: profile.id, property };
}

// ============================================
// METERS CRUD
// ============================================

export async function createMeter(
  propertyId: string,
  data: z.infer<typeof meterSchemaV3>
): Promise<ActionResult<{ id: string }>> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const parsed = meterSchemaV3.safeParse({ ...data, property_id: propertyId });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Données invalides" };
    }

    const { data: meter, error } = await supabase
      .from("property_meters")
      .insert({
        property_id: propertyId,
        meter_type: parsed.data.meter_type,
        meter_number: parsed.data.meter_number || null,
        location: parsed.data.location || null,
        is_individual: parsed.data.is_individual,
        provider: parsed.data.provider || null,
        last_reading_value: parsed.data.last_reading_value || null,
        last_reading_date: parsed.data.last_reading_date || null,
        notes: parsed.data.notes || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createMeter] Error:", error);
      return { success: false, error: "Erreur lors de la création du compteur" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true, data: { id: meter.id } };
  } catch (err) {
    console.error("[createMeter] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function updateMeter(
  propertyId: string,
  meterId: string,
  data: Partial<z.infer<typeof meterSchemaV3>>
): Promise<ActionResult> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const { error } = await supabase
      .from("property_meters")
      .update({
        ...(data.meter_type && { meter_type: data.meter_type }),
        ...(data.meter_number !== undefined && { meter_number: data.meter_number }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.is_individual !== undefined && { is_individual: data.is_individual }),
        ...(data.provider !== undefined && { provider: data.provider }),
        ...(data.last_reading_value !== undefined && { last_reading_value: data.last_reading_value }),
        ...(data.last_reading_date !== undefined && { last_reading_date: data.last_reading_date }),
        ...(data.notes !== undefined && { notes: data.notes }),
      })
      .eq("id", meterId)
      .eq("property_id", propertyId);

    if (error) {
      console.error("[updateMeter] Error:", error);
      return { success: false, error: "Erreur lors de la mise à jour du compteur" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateMeter] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function deleteMeter(
  propertyId: string,
  meterId: string
): Promise<ActionResult> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const { error } = await supabase
      .from("property_meters")
      .delete()
      .eq("id", meterId)
      .eq("property_id", propertyId);

    if (error) {
      console.error("[deleteMeter] Error:", error);
      return { success: false, error: "Erreur lors de la suppression du compteur" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteMeter] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function listMeters(
  propertyId: string
): Promise<ActionResult<any[]>> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const { data: meters, error } = await supabase
      .from("property_meters")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[listMeters] Error:", error);
      return { success: false, error: "Erreur lors du chargement des compteurs" };
    }

    return { success: true, data: meters || [] };
  } catch (err) {
    console.error("[listMeters] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

// ============================================
// DIAGNOSTICS CRUD
// ============================================

export async function createDiagnostic(
  propertyId: string,
  data: z.infer<typeof diagnosticSchemaV3>
): Promise<ActionResult<{ id: string }>> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const parsed = diagnosticSchemaV3.safeParse({ ...data, property_id: propertyId });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Données invalides" };
    }

    const { data: diagnostic, error } = await supabase
      .from("property_diagnostics")
      .insert({
        property_id: propertyId,
        diagnostic_type: parsed.data.diagnostic_type,
        date_performed: parsed.data.date_performed || null,
        expiry_date: parsed.data.expiry_date || null,
        result: parsed.data.result || {},
        document_url: parsed.data.document_url || null,
        provider_name: parsed.data.provider_name || null,
        provider_certification: parsed.data.provider_certification || null,
        notes: parsed.data.notes || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createDiagnostic] Error:", error);
      return { success: false, error: "Erreur lors de la création du diagnostic" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true, data: { id: diagnostic.id } };
  } catch (err) {
    console.error("[createDiagnostic] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function updateDiagnostic(
  propertyId: string,
  diagnosticId: string,
  data: Partial<z.infer<typeof diagnosticSchemaV3>>
): Promise<ActionResult> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const { error } = await supabase
      .from("property_diagnostics")
      .update({
        ...(data.diagnostic_type && { diagnostic_type: data.diagnostic_type }),
        ...(data.date_performed !== undefined && { date_performed: data.date_performed }),
        ...(data.expiry_date !== undefined && { expiry_date: data.expiry_date }),
        ...(data.result !== undefined && { result: data.result }),
        ...(data.document_url !== undefined && { document_url: data.document_url }),
        ...(data.provider_name !== undefined && { provider_name: data.provider_name }),
        ...(data.provider_certification !== undefined && { provider_certification: data.provider_certification }),
        ...(data.notes !== undefined && { notes: data.notes }),
      })
      .eq("id", diagnosticId)
      .eq("property_id", propertyId);

    if (error) {
      console.error("[updateDiagnostic] Error:", error);
      return { success: false, error: "Erreur lors de la mise à jour du diagnostic" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateDiagnostic] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function deleteDiagnostic(
  propertyId: string,
  diagnosticId: string
): Promise<ActionResult> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const { error } = await supabase
      .from("property_diagnostics")
      .delete()
      .eq("id", diagnosticId)
      .eq("property_id", propertyId);

    if (error) {
      console.error("[deleteDiagnostic] Error:", error);
      return { success: false, error: "Erreur lors de la suppression du diagnostic" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteDiagnostic] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function listDiagnostics(
  propertyId: string
): Promise<ActionResult<any[]>> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const { data: diagnostics, error } = await supabase
      .from("property_diagnostics")
      .select("*")
      .eq("property_id", propertyId)
      .order("diagnostic_type", { ascending: true });

    if (error) {
      console.error("[listDiagnostics] Error:", error);
      return { success: false, error: "Erreur lors du chargement des diagnostics" };
    }

    return { success: true, data: diagnostics || [] };
  } catch (err) {
    console.error("[listDiagnostics] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

// ============================================
// EQUIPMENT CRUD
// ============================================

export async function createEquipment(
  propertyId: string,
  data: z.infer<typeof equipmentSchemaV3>
): Promise<ActionResult<{ id: string }>> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const parsed = equipmentSchemaV3.safeParse({ ...data, property_id: propertyId });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Données invalides" };
    }

    const { data: equipment, error } = await supabase
      .from("property_equipment")
      .insert({
        property_id: propertyId,
        category: parsed.data.category,
        name: parsed.data.name,
        brand: parsed.data.brand || null,
        model: parsed.data.model || null,
        serial_number: parsed.data.serial_number || null,
        condition: parsed.data.condition,
        installation_date: parsed.data.installation_date || null,
        warranty_end: parsed.data.warranty_end || null,
        is_included_in_lease: parsed.data.is_included_in_lease,
        notes: parsed.data.notes || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createEquipment] Error:", error);
      return { success: false, error: "Erreur lors de la création de l'équipement" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true, data: { id: equipment.id } };
  } catch (err) {
    console.error("[createEquipment] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function updateEquipment(
  propertyId: string,
  equipmentId: string,
  data: Partial<z.infer<typeof equipmentSchemaV3>>
): Promise<ActionResult> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const { error } = await supabase
      .from("property_equipment")
      .update({
        ...(data.category && { category: data.category }),
        ...(data.name && { name: data.name }),
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.model !== undefined && { model: data.model }),
        ...(data.serial_number !== undefined && { serial_number: data.serial_number }),
        ...(data.condition && { condition: data.condition }),
        ...(data.installation_date !== undefined && { installation_date: data.installation_date }),
        ...(data.warranty_end !== undefined && { warranty_end: data.warranty_end }),
        ...(data.is_included_in_lease !== undefined && { is_included_in_lease: data.is_included_in_lease }),
        ...(data.notes !== undefined && { notes: data.notes }),
      })
      .eq("id", equipmentId)
      .eq("property_id", propertyId);

    if (error) {
      console.error("[updateEquipment] Error:", error);
      return { success: false, error: "Erreur lors de la mise à jour de l'équipement" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateEquipment] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function deleteEquipment(
  propertyId: string,
  equipmentId: string
): Promise<ActionResult> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const { error } = await supabase
      .from("property_equipment")
      .delete()
      .eq("id", equipmentId)
      .eq("property_id", propertyId);

    if (error) {
      console.error("[deleteEquipment] Error:", error);
      return { success: false, error: "Erreur lors de la suppression de l'équipement" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteEquipment] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function listEquipment(
  propertyId: string
): Promise<ActionResult<any[]>> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    const { data: equipment, error } = await supabase
      .from("property_equipment")
      .select("*")
      .eq("property_id", propertyId)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("[listEquipment] Error:", error);
      return { success: false, error: "Erreur lors du chargement des équipements" };
    }

    return { success: true, data: equipment || [] };
  } catch (err) {
    console.error("[listEquipment] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

// ============================================
// BATCH SAVE (for wizard step completion)
// ============================================

export async function saveMetersBatch(
  propertyId: string,
  meters: z.infer<typeof meterSchemaV3>[]
): Promise<ActionResult<{ ids: string[] }>> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    // Delete existing meters first
    await supabase.from("property_meters").delete().eq("property_id", propertyId);

    if (meters.length === 0) {
      revalidatePath(`/owner/properties/${propertyId}`);
      return { success: true, data: { ids: [] } };
    }

    const rows = meters.map(m => ({
      property_id: propertyId,
      meter_type: m.meter_type,
      meter_number: m.meter_number || null,
      location: m.location || null,
      is_individual: m.is_individual,
      provider: m.provider || null,
      last_reading_value: m.last_reading_value || null,
      last_reading_date: m.last_reading_date || null,
      notes: m.notes || null,
    }));

    const { data: created, error } = await supabase
      .from("property_meters")
      .insert(rows)
      .select("id");

    if (error) {
      console.error("[saveMetersBatch] Error:", error);
      return { success: false, error: "Erreur lors de la sauvegarde des compteurs" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true, data: { ids: (created || []).map(r => r.id) } };
  } catch (err) {
    console.error("[saveMetersBatch] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function saveDiagnosticsBatch(
  propertyId: string,
  diagnostics: z.infer<typeof diagnosticSchemaV3>[]
): Promise<ActionResult<{ ids: string[] }>> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    // Delete existing diagnostics first
    await supabase.from("property_diagnostics").delete().eq("property_id", propertyId);

    if (diagnostics.length === 0) {
      revalidatePath(`/owner/properties/${propertyId}`);
      return { success: true, data: { ids: [] } };
    }

    const rows = diagnostics.map(d => ({
      property_id: propertyId,
      diagnostic_type: d.diagnostic_type,
      date_performed: d.date_performed || null,
      expiry_date: d.expiry_date || null,
      result: d.result || {},
      document_url: d.document_url || null,
      provider_name: d.provider_name || null,
      provider_certification: d.provider_certification || null,
      notes: d.notes || null,
    }));

    const { data: created, error } = await supabase
      .from("property_diagnostics")
      .insert(rows)
      .select("id");

    if (error) {
      console.error("[saveDiagnosticsBatch] Error:", error);
      return { success: false, error: "Erreur lors de la sauvegarde des diagnostics" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true, data: { ids: (created || []).map(r => r.id) } };
  } catch (err) {
    console.error("[saveDiagnosticsBatch] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function saveEquipmentBatch(
  propertyId: string,
  equipment: z.infer<typeof equipmentSchemaV3>[]
): Promise<ActionResult<{ ids: string[] }>> {
  try {
    const result = await verifyPropertyOwnership(propertyId);
    if ("error" in result) return { success: false, error: result.error };
    const { supabase } = result;

    // Delete existing equipment first
    await supabase.from("property_equipment").delete().eq("property_id", propertyId);

    if (equipment.length === 0) {
      revalidatePath(`/owner/properties/${propertyId}`);
      return { success: true, data: { ids: [] } };
    }

    const rows = equipment.map(e => ({
      property_id: propertyId,
      category: e.category,
      name: e.name,
      brand: e.brand || null,
      model: e.model || null,
      serial_number: e.serial_number || null,
      condition: e.condition,
      installation_date: e.installation_date || null,
      warranty_end: e.warranty_end || null,
      is_included_in_lease: e.is_included_in_lease,
      notes: e.notes || null,
    }));

    const { data: created, error } = await supabase
      .from("property_equipment")
      .insert(rows)
      .select("id");

    if (error) {
      console.error("[saveEquipmentBatch] Error:", error);
      return { success: false, error: "Erreur lors de la sauvegarde des équipements" };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    return { success: true, data: { ids: (created || []).map(r => r.id) } };
  } catch (err) {
    console.error("[saveEquipmentBatch] Exception:", err);
    return { success: false, error: "Erreur inattendue" };
  }
}
