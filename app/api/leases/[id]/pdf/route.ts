// @ts-nocheck
/**
 * API Route: Génération et téléchargement du PDF d'un bail
 * GET /api/leases/[id]/pdf
 * 
 * Génère le PDF complet du bail avec toutes les informations légales
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail";
import type { TypeBail, BailComplet } from "@/lib/templates/bail/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;

    if (!leaseId) {
      return NextResponse.json(
        { error: "ID du bail requis" },
        { status: 400 }
      );
    }

    // Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer le profil de l'utilisateur
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom, telephone")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Utiliser le service client pour récupérer toutes les données
    const serviceClient = getServiceClient();

    // Récupérer le bail avec toutes les données associées
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties (
          id,
          owner_id,
          adresse_complete,
          code_postal,
          ville,
          type,
          surface,
          nb_pieces,
          etage,
          nb_etages_immeuble,
          annee_construction,
          dpe_classe,
          dpe_ges,
          chauffage_type,
          chauffage_energie,
          eau_chaude_type,
          description
        ),
        signers:lease_signers (
          id,
          role,
          signature_status,
          signed_at,
          profile:profiles (
            id,
            prenom,
            nom,
            telephone,
            date_naissance
          )
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier les permissions
    const property = lease.property as any;
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";
    const isSigner = (lease.signers as any[])?.some(s => s.profile?.id === profile.id);

    if (!isOwner && !isAdmin && !isSigner) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à voir ce bail" },
        { status: 403 }
      );
    }

    // Récupérer les infos du propriétaire (owner_profiles)
    const { data: ownerProfile } = await serviceClient
      .from("owner_profiles")
      .select("*")
      .eq("profile_id", property.owner_id)
      .single();

    // Préparer les données pour le template
    const typeBail = (lease.type_bail || "meuble") as TypeBail;
    
    // Trouver le locataire principal
    const tenantSigner = (lease.signers as any[])?.find(s => s.role === "locataire_principal");
    const tenant = tenantSigner?.profile;

    // Construire les données du bail selon le format attendu
    const bailData: Partial<BailComplet> = {
      reference: leaseId.slice(0, 8).toUpperCase(),
      date_signature: lease.created_at,
      lieu_signature: property?.ville || "",
      
      // Bailleur
      bailleur: {
        nom: profile.nom || "",
        prenom: profile.prenom || "",
        adresse: ownerProfile?.adresse_facturation || `${property?.adresse_complete}, ${property?.code_postal} ${property?.ville}`,
        code_postal: property?.code_postal || "",
        ville: property?.ville || "",
        telephone: profile.telephone || "",
        type: ownerProfile?.type || "particulier",
        siret: ownerProfile?.siret,
        est_mandataire: false,
      },

      // Locataire(s)
      locataires: tenant ? [{
        nom: tenant.nom || lease.tenant_name_pending || "",
        prenom: tenant.prenom || "",
        date_naissance: tenant.date_naissance,
        lieu_naissance: "",
        nationalite: "Française",
        telephone: tenant.telephone || "",
      }] : lease.tenant_name_pending ? [{
        nom: lease.tenant_name_pending,
        prenom: "",
        date_naissance: undefined,
        lieu_naissance: "",
        nationalite: "Française",
        telephone: "",
      }] : [],

      // Logement
      logement: {
        adresse_complete: property?.adresse_complete || "",
        code_postal: property?.code_postal || "",
        ville: property?.ville || "",
        type: property?.type || "appartement",
        surface_habitable: property?.surface || 0,
        nb_pieces_principales: property?.nb_pieces || 1,
        etage: property?.etage,
        nb_etages_immeuble: property?.nb_etages_immeuble,
        epoque_construction: mapEpoqueConstruction(property?.annee_construction),
        regime: "mono_propriete",
        chauffage_type: property?.chauffage_type || "individuel",
        chauffage_energie: property?.chauffage_energie || "electricite",
        eau_chaude_type: property?.eau_chaude_type || "individuel",
        eau_chaude_energie: property?.chauffage_energie || "electricite",
        equipements_privatifs: [],
        parties_communes: [],
        annexes: [],
      },

      // Conditions du bail
      conditions: {
        date_debut: lease.date_debut,
        date_fin: lease.date_fin,
        duree_mois: typeBail === "nu" ? 36 : typeBail === "meuble" ? 12 : 12,
        tacite_reconduction: true,
        loyer_hc: parseFloat(lease.loyer) || 0,
        loyer_en_lettres: numberToWords(parseFloat(lease.loyer) || 0),
        charges_montant: parseFloat(lease.charges_forfaitaires) || 0,
        charges_type: "forfait",
        depot_garantie: parseFloat(lease.depot_de_garantie) || 0,
        depot_garantie_en_lettres: numberToWords(parseFloat(lease.depot_de_garantie) || 0),
        mode_paiement: "virement",
        periodicite_paiement: "mensuelle",
        jour_paiement: 5,
        paiement_avance: true,
        revision_autorisee: true,
      },

      // Diagnostics
      diagnostics: {
        dpe: {
          date_realisation: new Date().toISOString(),
          classe_energie: property?.dpe_classe || "D",
          classe_ges: property?.dpe_ges || "D",
          consommation_energie: 150,
          estimation_cout_min: 800,
          estimation_cout_max: 1200,
        },
      },
    };

    // Générer le HTML
    const html = LeaseTemplateService.generateHTML(typeBail, bailData);

    // Générer le PDF
    const pdfBuffer = await generatePDF(html);

    // Retourner le PDF
    const fileName = `Bail_${typeBail}_${property?.ville || "location"}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });

  } catch (error: any) {
    console.error("Erreur génération PDF bail:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPERS
// ============================================

function mapEpoqueConstruction(annee?: number): string {
  if (!annee) return "apres_2005";
  if (annee < 1949) return "avant_1949";
  if (annee < 1975) return "1949_1974";
  if (annee < 1990) return "1975_1989";
  if (annee < 2006) return "1990_2005";
  return "apres_2005";
}

function numberToWords(n: number): string {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  if (n < 20) return units[Math.floor(n)];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = Math.floor(n % 10);
    if (t === 7 || t === 9) {
      return tens[t] + (u === 1 && t === 7 ? '-et-' : '-') + units[10 + u];
    }
    return tens[t] + (u === 1 && t !== 8 ? '-et-' : (u ? '-' : '')) + units[u];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = Math.floor(n % 100);
    return (h === 1 ? 'cent' : units[h] + ' cent') + (r ? ' ' + numberToWords(r) : (h > 1 ? 's' : ''));
  }
  if (n < 10000) {
    const m = Math.floor(n / 1000);
    const r = Math.floor(n % 1000);
    return (m === 1 ? 'mille' : units[m] + ' mille') + (r ? ' ' + numberToWords(r) : '');
  }
  return `${n.toFixed(2)} euros`;
}

/**
 * Générer le PDF à partir du HTML
 */
async function generatePDF(html: string): Promise<Buffer> {
  // Option 1: Essayer l'Edge Function Supabase
  try {
    const edgeFunctionUrl = process.env.SUPABASE_FUNCTIONS_URL;
    if (edgeFunctionUrl) {
      const response = await fetch(`${edgeFunctionUrl}/html-to-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ html }),
      });

      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
    }
  } catch (error) {
    console.error("Edge Function PDF non disponible:", error);
  }

  // Option 2: Utiliser pdf-lib pour un PDF basique
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Page 1 - Titre et parties
  const page1 = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page1.getSize();
  let y = height - 50;

  // Titre
  page1.drawText("CONTRAT DE LOCATION", {
    x: 50,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0, 0, 0.5),
  });
  y -= 30;

  page1.drawText("Conforme à la loi ALUR du 24 mars 2014", {
    x: 50,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 50;

  // Message d'information
  page1.drawText("Ce document est une version prévisualisation.", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  page1.drawText("Le PDF complet avec toutes les clauses légales sera généré", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  page1.drawText("lors de l'activation du bail après signatures.", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 40;

  // Instructions
  page1.drawText("Pour générer le PDF complet :", {
    x: 50,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 25;

  const instructions = [
    "1. Configurez la variable SUPABASE_FUNCTIONS_URL",
    "2. Déployez l'Edge Function 'html-to-pdf'",
    "3. Ou utilisez l'aperçu HTML et imprimez en PDF",
  ];

  for (const instruction of instructions) {
    page1.drawText(instruction, {
      x: 60,
      y,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 18;
  }

  y -= 30;

  // Info technique
  page1.drawRectangle({
    x: 45,
    y: y - 60,
    width: width - 90,
    height: 70,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  page1.drawText("💡 Astuce : Utilisez la page d'aperçu pour imprimer le bail complet", {
    x: 55,
    y: y - 25,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.5),
  });

  page1.drawText("en PDF via votre navigateur (Cmd/Ctrl + P > Enregistrer en PDF)", {
    x: 55,
    y: y - 45,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Pied de page
  page1.drawText(`Document généré le ${new Date().toLocaleDateString("fr-FR")}`, {
    x: 50,
    y: 30,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

