// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

interface PageProps {
  params: Promise<{ token: string }>;
}

// Décoder le token (format: leaseId:email:timestamp en base64url)
function decodeToken(token: string): { leaseId: string; tenantEmail: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [leaseId, tenantEmail, timestampStr] = decoded.split(":");
    if (!leaseId || !tenantEmail || !timestampStr) return null;
    return { leaseId, tenantEmail, timestamp: parseInt(timestampStr, 10) };
  } catch {
    return null;
  }
}

// Vérifier si le token est expiré (7 jours)
function isTokenExpired(timestamp: number): boolean {
  return Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
}

/**
 * POST /api/signature/[token]/upload-cni
 * Upload de la photo CNI (sans OCR - vérification manuelle)
 * 
 * Rate limiting: 10 requêtes par minute par IP pour éviter les abus
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
    // Rate limiting basé sur l'IP (10 uploads/minute max)
    const rateLimitResponse = applyRateLimit(request, "upload");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { token } = await params;

    // Décoder le token
    const tokenData = decodeToken(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Lien d'invitation invalide" },
        { status: 404 }
      );
    }

    // Vérifier expiration
    if (isTokenExpired(tokenData.timestamp)) {
      return NextResponse.json(
        { error: "Le lien d'invitation a expiré" },
        { status: 410 }
      );
    }

    const serviceClient = getServiceClient();

    // Récupérer le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, statut")
      .eq("id", tokenData.leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer le fichier uploadé et les données OCR
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const side = formData.get("side") as string; // 'recto' ou 'verso'
    
    // Données OCR extraites côté client (optionnelles)
    const ocrDataRaw = formData.get("ocr_data") as string | null;
    let ocrData: Record<string, any> = {};
    if (ocrDataRaw) {
      try {
        ocrData = JSON.parse(ocrDataRaw);
      } catch {
        // Ignorer si JSON invalide
      }
    }

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Vérifier le type de fichier
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé. Utilisez JPG, PNG ou WEBP." },
        { status: 400 }
      );
    }

    // Vérifier la taille (max 10 Mo)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 10 Mo)" },
        { status: 400 }
      );
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const fileName = `cni_${side}_${lease.id}_${timestamp}.${extension}`;
    const filePath = `leases/${lease.id}/identity/${fileName}`;

    // Convertir le fichier en buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Essayer d'uploader vers le bucket "documents"
    let uploadData;
    let uploadError;
    
    // Tenter l'upload
    const uploadResult = await serviceClient.storage
      .from("documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });
    
    uploadData = uploadResult.data;
    uploadError = uploadResult.error;

    // Si le bucket n'existe pas, essayer de le créer
    if (uploadError && uploadError.message?.includes("Bucket not found")) {
      console.log("[Upload CNI] Bucket 'documents' non trouvé, tentative de création...");
      
      // Créer le bucket
      const { error: createError } = await serviceClient.storage.createBucket("documents", {
        public: false,
        fileSizeLimit: 52428800, // 50 Mo
      });
      
      if (createError && !createError.message?.includes("already exists")) {
        console.error("[Upload CNI] Erreur création bucket:", createError);
        return NextResponse.json(
          { error: "Erreur de configuration du stockage. Contactez le support." },
          { status: 500 }
        );
      }
      
      // Réessayer l'upload
      const retryResult = await serviceClient.storage
        .from("documents")
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true,
        });
      
      uploadData = retryResult.data;
      uploadError = retryResult.error;
    }

    if (uploadError) {
      console.error("[Upload CNI] Erreur upload:", uploadError);
      return NextResponse.json(
        { error: "Erreur lors de l'upload du fichier: " + uploadError.message },
        { status: 500 }
      );
    }

    // Données de base combinées avec OCR
    const extractedData = {
      document_type: "CNI",
      side,
      requires_manual_verification: !ocrData.date_expiration, // Si pas de date, vérif manuelle
      uploaded_at: new Date().toISOString(),
      file_size: file.size,
      file_type: file.type,
      // Données OCR extraites côté client
      nom: ocrData.nom || null,
      prenom: ocrData.prenom || null,
      date_naissance: ocrData.date_naissance || null,
      lieu_naissance: ocrData.lieu_naissance || null,
      sexe: ocrData.sexe || null,
      nationalite: ocrData.nationalite || null,
      numero_cni: ocrData.numero_cni || null,
      date_expiration: ocrData.date_expiration || null,
      ocr_confidence: ocrData.ocr_confidence || 0,
    };

    // Parser la date d'expiration pour la colonne SQL
    let expiryDate: string | null = null;
    if (ocrData.date_expiration) {
      // Format attendu: YYYY-MM-DD
      const dateMatch = ocrData.date_expiration.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateMatch) {
        expiryDate = ocrData.date_expiration;
      }
    }

    // Créer un document pour la CNI
    const { data: docData, error: docError } = await serviceClient
      .from("documents")
      .insert({
        type: side === "recto" ? "cni_recto" : "cni_verso",
        lease_id: lease.id,
        storage_path: filePath,
        expiry_date: expiryDate, // Date d'expiration pour le suivi
        verification_status: "pending", // En attente de vérification
        metadata: {
          ...extractedData,
          tenant_email: tokenData.tenantEmail,
        },
      })
      .select()
      .single();

    if (docError) {
      console.warn("[Upload CNI] Erreur création document DB:", docError);
      // On continue quand même, le fichier est uploadé
    } else {
      console.log("[Upload CNI] Document créé:", docData?.id, "expiry_date:", expiryDate);
    }

    // Retourner les données
    return NextResponse.json({
      success: true,
      file_path: filePath,
      side,
      extracted_data: extractedData,
      message: side === "recto" 
        ? "Photo recto enregistrée avec succès" 
        : "Photo verso enregistrée avec succès",
    });

  } catch (error: any) {
    console.error("[Upload CNI] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
