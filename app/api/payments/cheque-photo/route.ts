export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { STORAGE_BUCKETS } from "@/lib/config/storage-buckets";

/**
 * POST /api/payments/cheque-photo — Upload d'une photo de chèque
 *
 * Étape 1 du flux "enregistrer un paiement par chèque" :
 *   1. Le front appelle cette route en multipart/form-data avec le
 *      champ `file` (image) + `invoice_id`.
 *   2. La route valide la taille / le MIME, vérifie que l'utilisateur
 *      est bien propriétaire de la facture, uploade dans le bucket
 *      `payment-proofs` (privé) via le service client, puis renvoie
 *      le `storage_path`.
 *   3. Le front passe ensuite ce `storage_path` au POST /mark-paid
 *      qui le persiste dans `payments.cheque_photo_path`.
 *
 * La photo est OPTIONNELLE : si cette route échoue, le front logge
 * l'erreur et continue le flux mark-paid sans photo — c'est une
 * feature "nice to have" qui ne doit jamais bloquer l'enregistrement
 * du paiement (contrainte SOTA 2026).
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const invoiceId = formData.get("invoice_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Fichier requis (champ 'file')" },
        { status: 400 }
      );
    }

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoice_id requis" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: `Format non supporté (${file.type || "inconnu"}). Utilisez JPG, PNG, WebP ou HEIC.`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : 5 Mo.`,
        },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    // Autorisation : l'utilisateur doit être owner ou admin de la facture.
    // On resout via profiles → invoices (owner_id dénormalisé).
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as { id: string; role: string } | null;

    if (!profileData) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    const { data: invoice } = await serviceClient
      .from("invoices")
      .select("id, owner_id, lease_id")
      .eq("id", invoiceId)
      .maybeSingle();

    const invoiceData = invoice as
      | { id: string; owner_id: string | null; lease_id: string | null }
      | null;

    if (!invoiceData) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    const isAdmin = profileData.role === "admin";
    const isOwner = !!invoiceData.owner_id && invoiceData.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut uploader une preuve de paiement" },
        { status: 403 }
      );
    }

    // Déterminer l'extension à partir du MIME (garder cohérent même si le
    // navigateur mobile fournit un nom de fichier générique type "image.jpg").
    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
    };
    const ext = mimeToExt[file.type] || "jpg";
    const storagePath = `cheques/${invoiceId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from(STORAGE_BUCKETS.PAYMENT_PROOFS)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError || !uploadData) {
      console.error("[cheque-photo] Upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError?.message || "Erreur d'upload" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      storage_path: uploadData.path,
    });
  } catch (error: unknown) {
    console.error("[cheque-photo] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
