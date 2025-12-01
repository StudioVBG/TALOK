// @ts-nocheck
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// Force cette route à s'exécuter uniquement côté serveur
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    // 1. Fetch la page
    // Note: Certains sites bloquent les fetch serveurs sans User-Agent browser-like.
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error("Impossible d'accéder à l'URL");
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 2. Extraction des métadonnées OpenGraph (Standard Web)
    const ogTitle = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
    const ogDescription = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "";
    const ogImage = $('meta[property="og:image"]').attr("content");
    
    // 3. Tentative d'extraction intelligente (Heuristique simple)
    
    // Prix : Cherche un motif monétaire dans le titre ou la description
    // Regex pour trouver "1 200€", "1200 €", "1200€"
    const priceRegex = /(\d[\d\s]*)(?:€|eur|euros)/i;
    const priceMatch = ogTitle.match(priceRegex) || ogDescription.match(priceRegex);
    let price = null;
    if (priceMatch) {
      // Nettoyer le prix (enlever espaces)
      const cleanPrice = priceMatch[1].replace(/\s/g, "");
      price = parseInt(cleanPrice, 10);
    }

    // Surface : Cherche "XX m²" ou "XXm2"
    const surfaceRegex = /(\d+)(?:\s?)(?:m²|m2)/i;
    const surfaceMatch = ogTitle.match(surfaceRegex) || ogDescription.match(surfaceRegex);
    let surface = null;
    if (surfaceMatch) {
      surface = parseInt(surfaceMatch[1], 10);
    }

    // Type de bien : Recherche de mots clés
    let type = "appartement"; // Valeur par défaut
    const textForType = (ogTitle + " " + ogDescription).toLowerCase();
    if (textForType.includes("maison") || textForType.includes("villa")) type = "maison";
    else if (textForType.includes("studio")) type = "appartement";
    else if (textForType.includes("parking") || textForType.includes("garage")) type = "parking";
    else if (textForType.includes("commercial") || textForType.includes("local")) type = "commercial";
    else if (textForType.includes("bureau")) type = "bureau";
    else if (textForType.includes("colocation") || textForType.includes("chambre")) type = "colocation";

    // Ville/CP : Difficile sans géocodage, on essaie de trouver un Code Postal (5 chiffres)
    const cpRegex = /\b(0[1-9]|[1-8]\d|9[0-5]|97[1-6])\d{3}\b/; // Codes postaux FR (simplifié)
    const cpMatch = textForType.match(cpRegex);
    let cp = cpMatch ? cpMatch[0] : null;

    // Construction de la réponse
    const data = {
      titre: ogTitle.trim(),
      description: ogDescription.trim(),
      loyer_hc: price,
      surface: surface,
      type: type,
      code_postal: cp,
      ville: null, // Trop dur à extraire fiablement sans API de géocodage
      cover_url: ogImage || null,
      source_url: url,
    };

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("Scraping error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse de l'annonce", details: error.message },
      { status: 500 }
    );
  }
}



