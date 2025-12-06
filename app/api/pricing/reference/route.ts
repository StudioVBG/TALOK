// =====================================================
// API: Grille tarifaire de référence
// GET /api/pricing/reference
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import {
  getAllPricingForZone,
  getServicePricing,
  evaluatePrice,
  SERVICE_PRICING_REFERENCE,
  DROM_COEFFICIENTS,
  ZONE_LABELS,
  type PricingZone,
  type ServiceType,
} from '@/lib/data/service-pricing-reference';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const zone = (searchParams.get('zone') || 'france_metro') as PricingZone;
    const serviceType = searchParams.get('service_type') as ServiceType | null;
    const hourlyRate = searchParams.get('hourly_rate') ? parseFloat(searchParams.get('hourly_rate')!) : null;
    const isEmergency = searchParams.get('is_emergency') === 'true';
    
    // Si un service spécifique et un tarif sont demandés, évaluer
    if (serviceType && hourlyRate !== null) {
      const evaluation = evaluatePrice(serviceType, hourlyRate, zone, isEmergency);
      const pricing = getServicePricing(serviceType, zone);
      
      return NextResponse.json({
        success: true,
        service: pricing,
        evaluation,
        zone,
        is_emergency: isEmergency,
      });
    }
    
    // Si un service spécifique est demandé
    if (serviceType) {
      const pricing = getServicePricing(serviceType, zone);
      
      if (!pricing) {
        return NextResponse.json({ error: 'Service non trouvé' }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        service: pricing,
        zone,
      });
    }
    
    // Retourner toute la grille tarifaire
    const pricing = getAllPricingForZone(zone);
    
    return NextResponse.json({
      success: true,
      pricing,
      zone,
      zone_label: ZONE_LABELS[zone],
      zones: Object.entries(ZONE_LABELS).map(([key, label]) => ({
        value: key,
        label,
        coefficient: DROM_COEFFICIENTS[key as PricingZone],
      })),
      service_count: pricing.length,
    });
    
  } catch (error) {
    console.error('Erreur API pricing/reference:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

