export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route: Calcul du score de solvabilité
 * POST /api/applications/[id]/score
 * 
 * Cette route calcule le score de solvabilité d'un candidat locataire
 * en utilisant l'algorithme basé sur les normes ANIL et critères GLI.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calculateSolvabilityScore } from "@/lib/scoring";
import type { TenantScoreInput } from "@/lib/scoring/types";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const applicationId = params.id;

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent calculer le score" },
        { status: 403 }
      );
    }

    // Récupérer la candidature avec les données du locataire
    const { data: application, error: appError } = await supabase
      .from("tenant_applications")
      .select(`
        *,
        tenant_profile:tenant_profile_id (
          profile_id,
          situation_pro,
          revenus_mensuels,
          nb_adultes,
          nb_enfants,
          garant_required,
          profiles:profile_id (
            prenom,
            nom,
            date_naissance
          )
        ),
        property:property_id (
          id,
          loyer_hc,
          charges_mensuelles,
          loyer_base,
          owner_id
        )
      `)
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { error: "Candidature non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que le propriétaire est bien le propriétaire du logement
    const property = application.property as any;
    if (property?.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas le propriétaire de ce logement" },
        { status: 403 }
      );
    }

    // Récupérer les fichiers uploadés pour vérifier la complétude
    const { data: files } = await supabase
      .from("application_files")
      .select("kind, analyzed_at, confidence")
      .eq("application_id", applicationId);

    // Récupérer les champs extraits par OCR
    const { data: extractedFields } = await supabase
      .from("extracted_fields")
      .select("field_name, field_value, confidence")
      .eq("application_id", applicationId);

    // Construire l'input pour le scoring
    const tenantProfile = application.tenant_profile as any;
    const profileData = tenantProfile?.profiles as any;
    
    // Mapper les documents fournis
    const documentsProvided = {
      idCard: files?.some(f => f.kind === "identity") || false,
      proofOfIncome: files?.some(f => f.kind === "income") || false,
      taxNotice: files?.some(f => f.kind === "address") || false, // Avis d'imposition souvent dans "address"
      employmentContract: files?.some(f => f.kind === "guarantee") || false,
      previousRentReceipts: files?.some(f => f.kind === "other") || false,
    };

    // Mapper le type d'emploi
    const employmentTypeMap: Record<string, any> = {
      'CDI': 'cdi',
      'CDD': 'cdd',
      'Intérim': 'interim',
      'Freelance': 'freelance',
      'Indépendant': 'freelance',
      'Retraité': 'retraite',
      'Étudiant': 'etudiant',
      'Chômage': 'chomage',
    };

    const situationPro = tenantProfile?.situation_pro || '';
    const employmentType = employmentTypeMap[situationPro] || 'autre';

    // Récupérer les données du garant si présent
    const { data: guarantor } = await supabase
      .from("lease_signers")
      .select(`
        profile:profile_id (
          tenant_profiles (
            revenus_mensuels
          )
        )
      `)
      .eq("lease_id", application.lease_id || '')
      .eq("role", "garant")
      .maybeSingle();

    const guarantorIncome = (guarantor?.profile as any)?.tenant_profiles?.revenus_mensuels;

    // Construire l'input de scoring
    const scoreInput: TenantScoreInput = {
      firstName: profileData?.prenom || '',
      lastName: profileData?.nom || '',
      dateOfBirth: profileData?.date_naissance,
      monthlyIncome: tenantProfile?.revenus_mensuels || 0,
      incomeType: 'salary',
      employmentType,
      rentAmount: property?.loyer_hc || property?.loyer_base || 0,
      chargesAmount: property?.charges_mensuelles || 0,
      documentsProvided,
      hasGuarantor: tenantProfile?.garant_required || !!guarantor,
      guarantorIncome,
      guarantorType: guarantor ? 'person' : undefined,
      previousRentHistory: documentsProvided.previousRentReceipts ? 'good' : 'unknown',
      hasUnpaidRentHistory: false,
      ocrData: extractedFields ? {
        extractedIncome: extractedFields.find(f => f.field_name === 'net_salary')?.field_value 
          ? parseFloat(extractedFields.find(f => f.field_name === 'net_salary')!.field_value!)
          : undefined,
        extractedEmployer: extractedFields.find(f => f.field_name === 'employer')?.field_value || undefined,
        confidence: extractedFields.reduce((sum, f) => sum + (f.confidence || 0), 0) / (extractedFields.length || 1),
      } : undefined,
    };

    // Calculer le score
    const score = calculateSolvabilityScore(scoreInput);

    // Sauvegarder le score dans la candidature
    const { error: updateError } = await supabase
      .from("tenant_applications")
      .update({
        extracted_json: {
          ...((application.extracted_json as any) || {}),
          solvability_score: score,
        },
        confidence: score.totalScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (updateError) {
      console.error("Erreur sauvegarde score:", updateError);
    }

    // Journaliser l'action
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "score_calculated",
      entity_type: "tenant_application",
      entity_id: applicationId,
      metadata: {
        score: score.totalScore,
        recommendation: score.recommendation,
        risk_level: score.riskLevel,
      },
    });

    return NextResponse.json({
      success: true,
      score,
    });
  } catch (error: unknown) {
    console.error("Erreur calcul score:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// GET - Récupérer le dernier score calculé
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: application, error } = await supabase
      .from("tenant_applications")
      .select("extracted_json, confidence")
      .eq("id", params.id)
      .single();

    if (error || !application) {
      return NextResponse.json(
        { error: "Candidature non trouvée" },
        { status: 404 }
      );
    }

    const extractedJson = application.extracted_json as any;
    const score = extractedJson?.solvability_score;

    if (!score) {
      return NextResponse.json(
        { error: "Aucun score calculé" },
        { status: 404 }
      );
    }

    return NextResponse.json({ score });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

