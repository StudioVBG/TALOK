// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

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
 * Upload de la photo CNI avec extraction OCR
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
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

    // Récupérer le fichier uploadé
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const side = formData.get("side") as string; // 'recto' ou 'verso'

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

    // Upload vers Supabase Storage
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from("tenant-documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Erreur upload:", uploadError);
      return NextResponse.json(
        { error: "Erreur lors de l'upload du fichier" },
        { status: 500 }
      );
    }

    // Simuler l'extraction OCR
    // En production, utiliser un service OCR comme Google Vision, AWS Textract, ou Mindee
    const extractedData = await performOCR(buffer, side);

    // Créer un document pour la CNI
    await serviceClient
      .from("documents")
      .insert({
        type: side === "recto" ? "cni_recto" : "cni_verso",
        lease_id: lease.id,
        storage_path: filePath,
        metadata: {
          uploaded_at: new Date().toISOString(),
          tenant_email: tokenData.tenantEmail,
          ...extractedData,
        },
      });

    // Retourner les données extraites
    return NextResponse.json({
      success: true,
      file_path: filePath,
      side,
      extracted_data: extractedData,
      message: side === "recto" 
        ? "Photo recto analysée avec succès" 
        : "Photo verso enregistrée",
    });

  } catch (error: any) {
    console.error("Erreur API upload-cni:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Simuler l'extraction OCR des données de la CNI
 * En production, remplacer par un vrai service OCR
 */
async function performOCR(imageBuffer: Buffer, side: string): Promise<Record<string, any>> {
  // Simulation d'un délai d'analyse
  await new Promise(resolve => setTimeout(resolve, 500));

  if (side === "recto") {
    // Données extraites du recto de la CNI
    // En production, ces données viendraient du service OCR
    return {
      document_type: "CNI",
      nom: null, // À extraire via OCR
      prenom: null,
      date_naissance: null,
      lieu_naissance: null,
      sexe: null,
      nationalite: "FRANÇAISE",
      numero_cni: null,
      date_delivrance: null,
      date_expiration: null,
      ocr_confidence: 0, // Pas de vraie extraction
      ocr_raw_text: null,
      requires_manual_verification: true, // Indique qu'il faut vérifier manuellement
    };
  } else {
    // Données du verso (MRZ)
    return {
      mrz_line1: null,
      mrz_line2: null,
      mrz_valid: false,
    };
  }
}

/**
 * Intégration avec un vrai service OCR (exemple avec Mindee)
 * À décommenter et configurer en production
 */
/*
async function performOCRWithMindee(imageBuffer: Buffer): Promise<Record<string, any>> {
  const mindee = require("mindee");
  
  const mindeeClient = new mindee.Client({ apiKey: process.env.MINDEE_API_KEY });
  
  const inputSource = mindeeClient.docFromBuffer(imageBuffer, "document.jpg");
  const response = await mindeeClient.parse(
    mindee.product.fr.IdCardV2,
    inputSource
  );
  
  const prediction = response.document.inference.prediction;
  
  return {
    document_type: "CNI",
    nom: prediction.surname?.value,
    prenom: prediction.givenNames?.map((g: any) => g.value).join(" "),
    date_naissance: prediction.birthDate?.value,
    lieu_naissance: prediction.birthPlace?.value,
    sexe: prediction.gender?.value,
    nationalite: prediction.nationality?.value,
    numero_cni: prediction.idNumber?.value,
    date_delivrance: prediction.issueDate?.value,
    date_expiration: prediction.expiryDate?.value,
    ocr_confidence: prediction.confidence,
    mrz_valid: prediction.mrzValid,
  };
}
*/

/**
 * Intégration avec Google Cloud Vision (exemple)
 */
/*
async function performOCRWithGoogleVision(imageBuffer: Buffer): Promise<Record<string, any>> {
  const vision = require("@google-cloud/vision");
  const client = new vision.ImageAnnotatorClient();
  
  const [result] = await client.documentTextDetection({
    image: { content: imageBuffer.toString("base64") },
  });
  
  const fullText = result.fullTextAnnotation?.text || "";
  
  // Parser le texte pour extraire les champs
  // Ceci nécessite une logique spécifique selon le format de la CNI
  return parseIDCardText(fullText);
}
*/

