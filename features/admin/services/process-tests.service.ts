/**
 * Process Tests Service
 * Service pour exécuter les scénarios de test automatisés
 */

import { apiClient } from "@/lib/api-client";
import { propertiesService } from "@/features/properties/services/properties.service";

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  steps: string[];
  shouldFail?: boolean;
}

export interface TestResult {
  success: boolean;
  error?: string;
  logs?: string[];
  data?: any;
}

const log = (message: string, logs: string[]): void => {
  const timestamp = new Date().toISOString();
  logs.push(`[${timestamp}] ${message}`);
  console.log(`[ProcessTest] ${message}`);
};

export async function runTestScenario(scenario: TestScenario): Promise<TestResult> {
  const logs: string[] = [];
  log(`Démarrage du test: ${scenario.name}`, logs);

  try {
    switch (scenario.id) {
      case "create_fast_T2_habitation":
        return await testCreateFastT2Habitation(logs);
      case "create_detailed_T3_habitation":
        return await testCreateDetailedT3Habitation(logs);
      case "create_parking":
        return await testCreateParking(logs);
      case "submit_without_photos":
        return await testSubmitWithoutPhotos(logs);
      case "switch_mode_location_with_active_lease":
        return await testSwitchModeLocationWithActiveLease(logs);
      default:
        throw new Error(`Scénario de test inconnu: ${scenario.id}`);
    }
  } catch (error: unknown) {
    log(`Erreur: ${error.message}`, logs);
    return {
      success: false,
      error: error.message,
      logs,
    };
  }
}

async function testCreateFastT2Habitation(logs: string[]): Promise<TestResult> {
  try {
    // Étape 1: Créer un brouillon
    log("Étape 1: Création du brouillon", logs);
    const draft = await propertiesService.createDraftProperty({
      type_bien: "appartement",
      usage_principal: "habitation",
      wizard_mode: "fast",
    } as any);
    log(`Brouillon créé: ${draft.id}`, logs);

    // Étape 2: Remplir les champs minimaux
    log("Étape 2: Remplissage des champs minimaux", logs);
    await propertiesService.updatePropertyGeneral(draft.id, {
      adresse_complete: "123 Rue de Test",
      code_postal: "75001",
      ville: "Paris",
      departement: "75",
      surface_habitable_m2: 50,
      nb_pieces: 2,
      nb_chambres: 1,
      meuble: false,
      loyer_hc: 800,
      charges_mensuelles: 100,
      depot_garantie: 900,
    } as any);
    log("Champs minimaux remplis", logs);

    // Étape 3: Ajouter une photo (simulation - nécessiterait un vrai fichier)
    log("Étape 3: Ajout d'une photo (simulé)", logs);
    // Note: L'ajout réel de photo nécessiterait un fichier, on simule ici
    log("Photo ajoutée (simulation)", logs);

    // Étape 4: Soumettre pour validation
    log("Étape 4: Soumission pour validation", logs);
    try {
      await propertiesService.submitProperty(draft.id);
      log("Soumission réussie", logs);
      return {
        success: true,
        logs,
        data: { propertyId: draft.id },
      };
    } catch (error: unknown) {
      // Si la soumission échoue à cause des photos manquantes, c'est attendu
      if (error.message?.includes("photo") || error.message?.includes("Photo")) {
        log("Soumission échouée (photos manquantes - attendu)", logs);
        return {
          success: false,
          error: "Photos manquantes (attendu pour ce test)",
          logs,
        };
      }
      throw error;
    }
  } catch (error: unknown) {
    log(`Erreur: ${error.message}`, logs);
    return {
      success: false,
      error: error.message,
      logs,
    };
  }
}

async function testCreateDetailedT3Habitation(logs: string[]): Promise<TestResult> {
  try {
    log("Étape 1: Création du brouillon en mode détaillé", logs);
    const draft = await propertiesService.createDraftProperty({
      type_bien: "maison",
      usage_principal: "habitation",
      wizard_mode: "detailed",
    } as any);
    log(`Brouillon créé: ${draft.id}`, logs);

    log("Étape 2: Remplissage des champs détaillés", logs);
    await propertiesService.updatePropertyGeneral(draft.id, {
      adresse_complete: "456 Avenue de Test",
      code_postal: "69001",
      ville: "Lyon",
      departement: "69",
      surface_habitable_m2: 90,
      nb_pieces: 4,
      nb_chambres: 3,
      meuble: false,
      etage: null,
      ascenseur: false,
      loyer_hc: 1200,
      charges_mensuelles: 150,
      depot_garantie: 1350,
    } as any);
    log("Champs détaillés remplis", logs);

    log("Étape 3: Création d'une pièce (simulé)", logs);
    // Note: Nécessiterait l'API rooms
    log("Pièce créée (simulation)", logs);

    log("Étape 4: Ajout de photos (simulé)", logs);
    log("Photos ajoutées (simulation)", logs);

    log("Étape 5: Soumission pour validation", logs);
    try {
      await propertiesService.submitProperty(draft.id);
      log("Soumission réussie", logs);
      return {
        success: true,
        logs,
        data: { propertyId: draft.id },
      };
    } catch (error: unknown) {
      log(`Soumission échouée: ${error.message}`, logs);
      return {
        success: false,
        error: error.message,
        logs,
      };
    }
  } catch (error: unknown) {
    log(`Erreur: ${error.message}`, logs);
    return {
      success: false,
      error: error.message,
      logs,
    };
  }
}

async function testCreateParking(logs: string[]): Promise<TestResult> {
  try {
    log("Étape 1: Création du brouillon parking", logs);
    const draft = await propertiesService.createDraftProperty({
      type_bien: "parking",
      usage_principal: "parking",
      wizard_mode: "fast",
    } as any);
    log(`Brouillon créé: ${draft.id}`, logs);

    log("Étape 2: Remplissage des champs parking", logs);
    await propertiesService.updatePropertyGeneral(draft.id, {
      adresse_complete: "789 Rue Parking",
      code_postal: "13001",
      ville: "Marseille",
      departement: "13",
      parking_type: "place_exterieure",
      parking_gabarit: "berline",
      loyer_hc: 80,
      depot_garantie: 80,
    } as any);
    log("Champs parking remplis", logs);

    log("Étape 3: Ajout d'une photo (simulé)", logs);
    log("Photo ajoutée (simulation)", logs);

    log("Étape 4: Soumission pour validation", logs);
    try {
      await propertiesService.submitProperty(draft.id);
      log("Soumission réussie", logs);
      return {
        success: true,
        logs,
        data: { propertyId: draft.id },
      };
    } catch (error: unknown) {
      log(`Soumission échouée: ${error.message}`, logs);
      return {
        success: false,
        error: error.message,
        logs,
      };
    }
  } catch (error: unknown) {
    log(`Erreur: ${error.message}`, logs);
    return {
      success: false,
      error: error.message,
      logs,
    };
  }
}

async function testSubmitWithoutPhotos(logs: string[]): Promise<TestResult> {
  try {
    log("Étape 1: Création du brouillon", logs);
    const draft = await propertiesService.createDraftProperty({
      type_bien: "appartement",
      usage_principal: "habitation",
      wizard_mode: "fast",
    } as any);
    log(`Brouillon créé: ${draft.id}`, logs);

    log("Étape 2: Remplissage des champs minimaux", logs);
    await propertiesService.updatePropertyGeneral(draft.id, {
      adresse_complete: "999 Rue Sans Photo",
      code_postal: "33000",
      ville: "Bordeaux",
      departement: "33",
      surface_habitable_m2: 40,
      nb_pieces: 1,
      nb_chambres: 0,
      meuble: false,
      loyer_hc: 600,
      charges_mensuelles: 80,
      depot_garantie: 680,
    } as any);
    log("Champs minimaux remplis", logs);

    log("Étape 3: Pas d'ajout de photos (intentionnel)", logs);

    log("Étape 4: Tentative de soumission (doit échouer)", logs);
    try {
      await propertiesService.submitProperty(draft.id);
      // Si on arrive ici, la soumission a réussi alors qu'elle devrait échouer
      log("ERREUR: La soumission a réussi alors qu'elle devrait échouer", logs);
      return {
        success: false,
        error: "La validation devrait échouer sans photos",
        logs,
      };
    } catch (error: unknown) {
      // C'est attendu que ça échoue
      log(`Soumission échouée comme attendu: ${error.message}`, logs);
      return {
        success: true, // Le test est réussi car l'erreur est attendue
        logs,
        data: { expectedError: error.message },
      };
    }
  } catch (error: unknown) {
    log(`Erreur: ${error.message}`, logs);
    return {
      success: false,
      error: error.message,
      logs,
    };
  }
}

async function testSwitchModeLocationWithActiveLease(logs: string[]): Promise<TestResult> {
  try {
    log("Étape 1: Création du bien avec mode_location='longue_duree'", logs);
    const draft = await propertiesService.createDraftProperty({
      type_bien: "appartement",
      usage_principal: "habitation",
      wizard_mode: "fast",
    } as any);
    log(`Brouillon créé: ${draft.id}`, logs);

    await propertiesService.updatePropertyGeneral(draft.id, {
      adresse_complete: "111 Rue Test Bail",
      code_postal: "31000",
      ville: "Toulouse",
      departement: "31",
      surface_habitable_m2: 60,
      nb_pieces: 2,
      nb_chambres: 1,
      meuble: false,
      mode_location: "longue_duree",
      loyer_hc: 700,
      charges_mensuelles: 90,
      depot_garantie: 790,
    } as any);
    log("Bien créé avec mode_location='longue_duree'", logs);

    log("Étape 2: Création d'un bail actif (simulé)", logs);
    // Note: Nécessiterait l'API leases pour créer un vrai bail
    log("Bail actif créé (simulation)", logs);

    log("Étape 3: Tentative de changement de mode_location (doit échouer)", logs);
    try {
      await propertiesService.updatePropertyGeneral(draft.id, {
        mode_location: "courte_duree",
      } as any);
      // Si on arrive ici, le changement a réussi alors qu'il devrait échouer
      log("ERREUR: Le changement a réussi alors qu'il devrait échouer", logs);
      return {
        success: false,
        error: "Le changement de mode_location devrait être bloqué avec un bail actif",
        logs,
      };
    } catch (error: unknown) {
      // Vérifier que c'est bien l'erreur active_lease_blocking
      const errorMessage = error instanceof Error ? error.message : "";
      const errorData = error.data || {};
      if (
        errorData.error === "active_lease_blocking" ||
        errorMessage.includes("active_lease_blocking") ||
        errorMessage.includes("bail actif")
      ) {
        log(`Changement bloqué comme attendu: ${errorMessage}`, logs);
        return {
          success: true, // Le test est réussi car l'erreur est attendue
          logs,
          data: { expectedError: errorMessage },
        };
      } else {
        log(`Erreur inattendue: ${errorMessage}`, logs);
        return {
          success: false,
          error: `Erreur inattendue: ${errorMessage}`,
          logs,
        };
      }
    }
  } catch (error: unknown) {
    log(`Erreur: ${error.message}`, logs);
    return {
      success: false,
      error: error.message,
      logs,
    };
  }
}

