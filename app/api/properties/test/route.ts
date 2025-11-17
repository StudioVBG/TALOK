import { NextResponse } from "next/server";

/**
 * Endpoint de test ultra-simple pour diagnostiquer les problèmes de timeout
 * GET /api/properties/test
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    // Retourner immédiatement sans aucune logique
    const elapsed = Date.now() - startTime;
    
    return NextResponse.json({ 
      properties: [],
      test: true,
      timestamp: Date.now(),
      elapsed: `${elapsed}ms`,
      message: "Endpoint de test fonctionnel"
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      test: true,
      timestamp: Date.now()
    }, { status: 500 });
  }
}

