/**
 * Helper pour émettre des événements analytics dans le wizard Property
 * 
 * Utilise la table outbox de Supabase pour l'event bus
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Émet un événement analytics dans l'outbox
 */
export async function emitAnalyticsEvent(
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) {
    // En développement, ne pas spammer la console avec ces warnings
    if (process.env.NODE_ENV === "development") {
      return;
    }
    console.warn("[analytics-events] Variables d'environnement manquantes, événement ignoré:", eventType);
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    await supabase.from("outbox").insert({
      event_type: eventType,
      payload,
      created_at: new Date().toISOString(),
    } as any);

    console.log(`[analytics-events] Événement émis: ${eventType}`, payload);
  } catch (error) {
    console.error(`[analytics-events] Erreur lors de l'émission de ${eventType}:`, error);
    // Ne pas bloquer le flux si l'analytics échoue
  }
}

/**
 * Événements du wizard Property
 */
export const PropertyWizardEvents = {
  // Étape 1 - Type
  TYPE_STEP_VIEW: "PropertyWizard.TypeStepView",
  TYPE_SELECTED: "PropertyWizard.TypeSelected",
  TYPE_FILTER_USED: "PropertyWizard.TypeFilterUsed",
  TYPE_SEARCH_USED: "PropertyWizard.TypeSearchUsed",
  CTA_CONTINUE_CLICK: "PropertyWizard.CtaContinueClick",

  // Étape 2 - Adresse
  PROP_ADDRESS_SUBMITTED: "PropertyWizard.AddressSubmitted",
  PROP_GEOCODED_OK: "PropertyWizard.GeocodedOk",
  PROP_GEOCODED_FAIL: "PropertyWizard.GeocodedFail",

  // Étape 3 - Détails
  UNIT_DETAILS_SAVED: "PropertyWizard.UnitDetailsSaved",

  // Étape 4 - Pièces
  ROOMS_SET: "PropertyWizard.RoomsSet",

  // Étape 5 - Photos
  PHOTOS_UPLOADED: "PropertyWizard.PhotosUploaded",

  // Étape 6 - Équipements
  FEATURES_SAVED: "PropertyWizard.FeaturesSaved",

  // Étape 7 - Publication
  LISTING_PUBLISH_CLICKED: "PropertyWizard.ListingPublishClicked",
  LISTING_PUBLISHED: "PropertyWizard.ListingPublished",
  LISTING_LINT_FAILED: "PropertyWizard.ListingLintFailed",

  // Étape 8 - Activation
  PROPERTY_ACTIVATED: "PropertyWizard.PropertyActivated",
  CODE_GENERATED: "PropertyWizard.CodeGenerated",

  // Étape 9 - Compteurs/EDL
  METER_ADDED: "PropertyWizard.MeterAdded",
  EDL_SCHEDULED: "PropertyWizard.EDLScheduled",
} as const;

