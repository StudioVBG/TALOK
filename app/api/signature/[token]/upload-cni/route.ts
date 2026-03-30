export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { verifyTokenCompat } from "@/lib/utils/secure-token";

// Imports pour OCR serveur (fallback)
let tesseractOCRService: any = null;
let mindeeService: any = null;

// Chargement lazy des services OCR pour éviter les erreurs si non disponibles
async function loadOCRServices() {
  if (!tesseractOCRService) {
    try {
      const tesseractModule = await import("@/lib/ocr/tesseract.service");
      tesseractOCRService = tesseractModule.tesseractOCRService;
    } catch (e) {
      console.warn("[OCR Server] Tesseract non disponible:", e);
    }
  }
  if (!mindeeService) {
    try {
      const mindeeModule = await import("@/lib/ocr/mindee.service");
      mindeeService = mindeeModule.mindeeService;
    } catch (e) {
      console.warn("[OCR Server] Mindee non disponible:", e);
    }
  }
}

interface PageProps {
  params: Promise<{ token: string }>;
}

// Token functions replaced by verifyTokenCompat from secure-token module

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

    // FIX: Utiliser verifyTokenCompat pour supporter les deux formats (HMAC + legacy)
    const tokenData = verifyTokenCompat(token, 30);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Lien d'invitation invalide ou expiré" },
        { status: 410 }
      );
    }

    const tenantEmail = tokenData.email;
    const serviceClient = getServiceClient();

    // Récupérer le bail avec property_id et owner_id
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        property_id,
        properties!inner(owner_id)
      `)
      .eq("id", tokenData.entityId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Extraire property_id et owner_id pour la visibilité
    const propertyId = lease.property_id || null;
    const ownerId = (lease.properties as any)?.owner_id || null;

    // Résoudre le profil du locataire via son email (peut être null si pas encore inscrit)
    let tenantProfileId: string | null = null;
    const { data: tenantProfileRow } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", tenantEmail)
      .eq("role", "tenant")
      .maybeSingle();
    if (tenantProfileRow) {
      tenantProfileId = tenantProfileRow.id;
    }

    // Récupérer le fichier uploadé et les données OCR
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const side = formData.get("side") as string; // 'recto' ou 'verso'
    
    // Données OCR extraites côté client (optionnelles)
    const ocrDataRaw = formData.get("ocr_data") as string | null;
    const manualExpiryDateRaw = formData.get("manual_expiry_date") as string | null;
    const ocrAttempted = formData.get("ocr_attempted") === "true";
    const ocrClientError = formData.get("ocr_client_error") as string | null;
    
    let ocrData: Record<string, any> = {};
    let ocrSource: "client" | "server" | "none" = "none";
    
    if (ocrDataRaw) {
      try {
        ocrData = JSON.parse(ocrDataRaw);
        ocrSource = "client";
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

    // ============================================
    // FALLBACK OCR SERVEUR si l'OCR client a échoué ou n'a pas extrait de données
    // ============================================
    const needsServerOCR = ocrSource === "none" || 
      (!ocrData.nom && !ocrData.numero_cni && !ocrData.date_expiration);
    
    if (needsServerOCR) {
      
      try {
        await loadOCRServices();
        
        // Essayer Mindee d'abord (plus précis) puis Tesseract (gratuit)
        let serverOcrResult: any = null;
        
        if (mindeeService) {
          try {
            serverOcrResult = await mindeeService.analyzeIdCard(buffer, file.name);
            
            if (serverOcrResult && serverOcrResult.confidence > 0.5) {
              ocrData = {
                nom: serverOcrResult.lastName || ocrData.nom,
                prenom: serverOcrResult.firstName || ocrData.prenom,
                date_naissance: serverOcrResult.birthDate || ocrData.date_naissance,
                lieu_naissance: serverOcrResult.birthPlace || ocrData.lieu_naissance,
                sexe: serverOcrResult.gender || ocrData.sexe,
                nationalite: serverOcrResult.nationality === "FRA" ? "Française" : (serverOcrResult.nationality || ocrData.nationalite),
                numero_cni: serverOcrResult.documentNumber || ocrData.numero_cni,
                date_expiration: serverOcrResult.expiryDate || ocrData.date_expiration,
                ocr_confidence: serverOcrResult.confidence,
              };
              ocrSource = "server";
            }
          } catch (mindeeError: any) {
            console.warn("[Upload CNI] OCR Mindee échoué:", mindeeError?.message);
          }
        }
        
        // Fallback sur Tesseract si Mindee n'a pas fonctionné
        if (ocrSource !== "server" && tesseractOCRService) {
          try {
            serverOcrResult = await tesseractOCRService.analyzeIdCard(buffer, file.name);
            
            if (serverOcrResult && serverOcrResult.confidence > 0.3) {
              ocrData = {
                nom: serverOcrResult.lastName || ocrData.nom,
                prenom: serverOcrResult.firstName || ocrData.prenom,
                date_naissance: serverOcrResult.birthDate || ocrData.date_naissance,
                lieu_naissance: serverOcrResult.birthPlace || ocrData.lieu_naissance,
                sexe: serverOcrResult.gender || ocrData.sexe,
                nationalite: serverOcrResult.nationality || ocrData.nationalite,
                numero_cni: serverOcrResult.documentNumber || ocrData.numero_cni,
                date_expiration: serverOcrResult.expiryDate || ocrData.date_expiration,
                ocr_confidence: serverOcrResult.confidence,
              };
              ocrSource = "server";
            }
          } catch (tesseractError: any) {
            console.warn("[Upload CNI] OCR Tesseract échoué:", tesseractError?.message);
          }
        }
      } catch (ocrError: any) {
        console.error("[Upload CNI] Erreur chargement services OCR:", ocrError?.message);
      }
    }

    // Données de base combinées avec OCR (client ou serveur)
    const extractedData = {
      document_type: "CNI",
      side,
      requires_manual_verification: !ocrData.date_expiration, // Si pas de date, vérif manuelle
      uploaded_at: new Date().toISOString(),
      file_size: file.size,
      file_type: file.type,
      ocr_source: ocrSource,
      // Données OCR extraites (client ou serveur)
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

    // Parser la date d'expiration pour la colonne SQL (OCR puis fallback saisie manuelle)
    let expiryDate: string | null = null;
    if (ocrData.date_expiration) {
      // Format attendu: YYYY-MM-DD
      const dateMatch = ocrData.date_expiration.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateMatch) {
        expiryDate = ocrData.date_expiration;
      }
    }
    if (!expiryDate && manualExpiryDateRaw && typeof manualExpiryDateRaw === "string") {
      const trimmed = manualExpiryDateRaw.trim();
      const manualMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (manualMatch) {
        const manualDateObj = new Date(trimmed + "T12:00:00Z");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (manualDateObj >= today) {
          expiryDate = trimmed;
        }
      }
    }

    // Construire un titre enrichi avec le nom du locataire
    const tenantName = ocrData.prenom && ocrData.nom 
      ? `${ocrData.prenom} ${ocrData.nom}` 
      : null;
    const sideLabel = side === "recto" ? "Recto" : "Verso";
    const docTitle = tenantName 
      ? `CNI ${sideLabel} - ${tenantName}`
      : `Carte d'Identité (${sideLabel})`;

    const docType = side === "recto" ? "cni_recto" : "cni_verso";

    // 🔄 ARCHIVER les anciennes CNI du même type pour ce bail (éviter doublons)
    const { data: existingDocs } = await serviceClient
      .from("documents")
      .select("id")
      .eq("lease_id", lease.id)
      .eq("type", docType)
      .eq("is_archived", false);

    if (existingDocs && existingDocs.length > 0) {
      await serviceClient
        .from("documents")
        .update({ is_archived: true })
        .eq("lease_id", lease.id)
        .eq("type", docType)
        .eq("is_archived", false);
    }

    // Créer un document pour la CNI avec toutes les liaisons
    const { data: docData, error: docError } = await serviceClient
      .from("documents")
      .insert({
        type: docType,
        title: docTitle,
        lease_id: lease.id,
        property_id: propertyId,
        owner_id: ownerId,
        tenant_id: tenantProfileId,
        storage_path: filePath,
        expiry_date: expiryDate,
        verification_status: "pending",
        is_archived: false,
        metadata: {
          ...extractedData,
          tenant_email: tenantEmail,
        },
      })
      .select()
      .single();

    // 🔗 Mettre à jour les anciens docs avec le lien vers le nouveau
    if (docData && existingDocs && existingDocs.length > 0) {
      await serviceClient
        .from("documents")
        .update({ replaced_by: docData.id })
        .eq("lease_id", lease.id)
        .eq("type", docType)
        .eq("is_archived", true)
        .is("replaced_by", null);
    }

    if (docError) {
      console.error("[Upload CNI] Erreur création document DB:", docError);
      // FIX: Retourner une erreur au lieu de succès silencieux
      return NextResponse.json({
        success: false,
        error: "Le fichier a été uploadé mais l'enregistrement en base a échoué",
        details: docError.message,
        file_path: filePath,
        side,
        extracted_data: extractedData,
        ocr_source: ocrSource,
      }, { status: 500 });
    }


    // Synchroniser tenant_profiles (si le locataire a déjà un compte)
    if (docData && tenantProfileId) {
      try {
        const cniNumber =
          (ocrData.numero_cni as string)?.trim() ||
          (ocrData.numero_document as string)?.trim() ||
          `CNI_UPLOADED_${docData.id}`;

        if (side === "recto") {
          await serviceClient
            .from("tenant_profiles")
            .upsert(
              {
                profile_id: tenantProfileId,
                cni_number: cniNumber,
                cni_recto_path: filePath,
                cni_expiry_date: expiryDate,
                cni_verified_at: new Date().toISOString(),
                cni_verification_method: "ocr_scan",
                kyc_status: "verified",
              },
              { onConflict: "profile_id" }
            );
        } else if (side === "verso") {
          await serviceClient
            .from("tenant_profiles")
            .update({ cni_verso_path: filePath })
            .eq("profile_id", tenantProfileId);
        }
      } catch (syncErr) {
        console.error("[Upload CNI] Erreur sync tenant_profiles:", syncErr);
      }
    }

    // Retourner les données avec info OCR
    return NextResponse.json({
      success: true,
      file_path: filePath,
      document_id: docData?.id,
      side,
      extracted_data: extractedData,
      ocr_source: ocrSource,
      message: side === "recto"
        ? "Photo recto enregistrée avec succès"
        : "Photo verso enregistrée avec succès",
    });

  } catch (error: unknown) {
    console.error("[Upload CNI] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
