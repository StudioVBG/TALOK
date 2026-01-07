export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// API Route: Génération PDF côté serveur
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateRegularisationHtml,
  generateCallForFundsHtml,
  generateAssemblyPvHtml,
  type RegularisationPdfData,
  type CallForFundsPdfData,
  type AssemblyPvPdfData
} from '@/lib/pdf/templates';
import { LeaseTemplateService } from '@/lib/templates/bail';
import type { BailComplet, TypeBail } from '@/lib/templates/bail/types';

export const maxDuration = 30;

// Types étendus pour inclure la gestion locative
interface PdfRequest {
  type: 'regularisation' | 'call_for_funds' | 'assembly_pv' | 'lease' | 'receipt' | 'invoice' | 'edl';
  data: any; // On utilise any pour simplifier car les types sont vérifiés dans les switch
  options?: {
    format?: 'A4' | 'Letter';
    orientation?: 'portrait' | 'landscape';
  };
}

export async function POST(req: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const body: PdfRequest = await req.json();
    const { type, data, options = {} } = body;

    // Valider le type de document
    const supportedTypes = ['regularisation', 'call_for_funds', 'assembly_pv', 'lease', 'receipt', 'invoice', 'edl'];
    if (!supportedTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type de document non supporté: ${type}` },
        { status: 400 }
      );
    }

    // Générer le HTML
    let html: string = "";
    let filename: string = "document.pdf";

    switch (type) {
      // --- Talok ---
      case 'lease':
        // Validation basique des données du bail
        const bailData = data.bail_data || data;
        const typeBail = (data.type_bail || 'nu') as TypeBail;
        
        try {
          html = LeaseTemplateService.generateHTML(typeBail, bailData);
          filename = `bail_${typeBail}_${new Date().getTime()}.pdf`;
        } catch (e: any) {
          console.error("Erreur génération HTML bail:", e);
          return NextResponse.json({ error: `Erreur template: ${e.message}` }, { status: 500 });
        }
        break;

      case 'receipt':
        // TODO: Implémenter le template de quittance
        html = "<h1>Quittance de loyer</h1><p>Template à implémenter</p>";
        filename = `quittance_${new Date().getTime()}.pdf`;
        break;
        
      case 'invoice':
        // TODO: Implémenter le template de facture
        html = "<h1>Facture</h1><p>Template à implémenter</p>";
        filename = `facture_${new Date().getTime()}.pdf`;
        break;

      // --- Gestion Syndic (Existant) ---
      case 'regularisation':
        html = generateRegularisationHtml(data as RegularisationPdfData);
        const regData = data as RegularisationPdfData;
        filename = `regularisation_${regData.fiscal_year}_${regData.tenant?.name?.replace(/\s+/g, '_') || 'locataire'}.pdf`;
        break;

      case 'call_for_funds':
        html = generateCallForFundsHtml(data as CallForFundsPdfData);
        const cfData = data as CallForFundsPdfData;
        filename = `appel_fonds_${cfData.call_number}_lot_${cfData.unit?.lot_number || 'inconnu'}.pdf`;
        break;

      case 'assembly_pv':
        html = generateAssemblyPvHtml(data as AssemblyPvPdfData);
        const pvData = data as AssemblyPvPdfData;
        filename = `pv_${pvData.assembly_type}_${pvData.assembly_number}.pdf`;
        break;

      default:
        return NextResponse.json(
          { error: 'Type de document non supporté (case manquant)' },
          { status: 400 }
        );
    }

    // Essayer Puppeteer si disponible, sinon retourner le HTML
    let pdfBuffer: Buffer | null = null;

    try {
      // Tenter d'utiliser Puppeteer (optionnel)
      // @ts-ignore - puppeteer est une dépendance optionnelle
      const puppeteer = await import(/* webpackIgnore: true */ 'puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        landscape: options.orientation === 'landscape',
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        printBackground: true
      });

      await browser.close();
    } catch (puppeteerError) {
      // Puppeteer non disponible ou erreur
      console.warn('Puppeteer non disponible ou erreur, retour HTML:', puppeteerError);
      
      // Alternative: Retourner le HTML pour génération côté client
      // C'est souvent mieux pour les environnements serverless sans chrome-aws-lambda
      return NextResponse.json({
        success: true,
        html,
        filename,
        method: 'client',
        message: 'Génération PDF côté serveur non disponible, le client doit imprimer le HTML'
      });
    }

    if (!pdfBuffer) {
      return NextResponse.json(
        { error: 'Échec de la génération PDF' },
        { status: 500 }
      );
    }

    // Retourner le PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Erreur génération PDF:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// =====================================================
// GET: Prévisualisation HTML
// =====================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  
  if (!type) {
    return NextResponse.json(
      { error: 'Paramètre type requis' },
      { status: 400 }
    );
  }

  // Pour la prévisualisation, retourner un exemple
  const sampleHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Prévisualisation PDF</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #333; }
      </style>
    </head>
    <body>
      <h1>Prévisualisation Document ${type}</h1>
      <p>Envoyez une requête POST avec les données pour générer le PDF.</p>
    </body>
    </html>
  `;

  return new NextResponse(sampleHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}
