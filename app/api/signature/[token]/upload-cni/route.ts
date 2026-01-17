export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

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
  return Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000;
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

    // Récupérer le bail avec property_id et owner_id
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id, 
        statut,
        property_id,
        properties!inner(owner_id)
      `)
      .eq("id", tokenData.leaseId)
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

    // Récupérer le fichier uploadé et les données OCR
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const side = formData.get("side") as string; // 'recto' ou 'verso'
    
    // Données OCR extraites côté client (optionnelles)
    const ocrDataRaw = formData.get("ocr_data") as string | null;
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

    // ============================================
    // FALLBACK OCR SERVEUR si l'OCR client a échoué ou n'a pas extrait de données
    // ============================================
    const needsServerOCR = ocrSource === "none" || 
      (!ocrData.nom && !ocrData.numero_cni && !ocrData.date_expiration);
    
    if (needsServerOCR) {
      console.log(`[Upload CNI] OCR serveur nécessaire (client: ${ocrAttempted ? 'échoué' : 'non tenté'}${ocrClientError ? ` - ${ocrClientError}` : ''})`);
      
      try {
        await loadOCRServices();
        
        // Essayer Mindee d'abord (plus précis) puis Tesseract (gratuit)
        let serverOcrResult: any = null;
        
        if (mindeeService) {
          try {
            console.log("[Upload CNI] Tentative OCR Mindee...");
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
              console.log("[Upload CNI] OCR Mindee réussi, confiance:", serverOcrResult.confidence);
            }
          } catch (mindeeError: any) {
            console.warn("[Upload CNI] OCR Mindee échoué:", mindeeError?.message);
          }
        }
        
        // Fallback sur Tesseract si Mindee n'a pas fonctionné
        if (ocrSource !== "server" && tesseractOCRService) {
          try {
            console.log("[Upload CNI] Tentative OCR Tesseract...");
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
              console.log("[Upload CNI] OCR Tesseract réussi, confiance:", serverOcrResult.confidence);
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

    // Parser la date d'expiration pour la colonne SQL
    let expiryDate: string | null = null;
    if (ocrData.date_expiration) {
      // Format attendu: YYYY-MM-DD
      const dateMatch = ocrData.date_expiration.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateMatch) {
        expiryDate = ocrData.date_expiration;
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
      console.log(`[Upload CNI] Archivage de ${existingDocs.length} ancien(s) document(s) ${docType}`);
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
        title: docTitle,                // ✅ Titre enrichi
        lease_id: lease.id,
        property_id: propertyId,        // ✅ AJOUT - Permet au propriétaire de voir
        owner_id: ownerId,              // ✅ AJOUT - Liaison avec le propriétaire
        storage_path: filePath,
        expiry_date: expiryDate,        // Date d'expiration pour le suivi
        verification_status: "pending", // En attente de vérification
        is_archived: false,             // ✅ Explicitement non archivé
        metadata: {
          ...extractedData,
          tenant_email: tokenData.tenantEmail,
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
      console.warn("[Upload CNI] Erreur création document DB:", docError);
      // On continue quand même, le fichier est uploadé
    } else {
      console.log("[Upload CNI] Document créé:", docData?.id, "expiry_date:", expiryDate);
    }

    // Retourner les données avec info OCR
    return NextResponse.json({
      success: true,
      file_path: filePath,
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
