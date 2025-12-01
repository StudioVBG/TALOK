import { z } from 'zod';

// Schéma pour mettre à jour les infos générales du bien
export const updatePropertySchema = z.object({
  type_bien: z.enum([
    "appartement", "maison", "studio", "colocation", 
    "parking", "box", "local_commercial", "bureaux", "entrepot"
  ]).optional().describe("Le type de bien immobilier"),
  
  adresse_complete: z.string().optional().describe("L'adresse complète du bien"),
  ville: z.string().optional(),
  code_postal: z.string().optional(),
  
  surface: z.number().optional().describe("La surface totale en m²"),
  etage: z.number().optional().describe("L'étage du bien (0 pour RDC)"),
  ascenseur: z.boolean().optional(),
  
  loyer_base: z.number().optional().describe("Le montant du loyer hors charges"),
  charges_mensuelles: z.number().optional().describe("Le montant des charges mensuelles"),
  
  meuble: z.boolean().optional().describe("Si le bien est loué meublé"),
  
  nb_pieces: z.number().optional(),
  nb_chambres: z.number().optional(),
});

// Schéma pour ajouter une pièce
export const addRoomSchema = z.object({
  type_piece: z.enum([
    "sejour", "salon_cuisine", "chambre", "cuisine", "salle_de_bain", "wc", 
    "entree", "balcon", "terrasse", "parking", "cave", "bureau", "dressing"
  ]).describe("Le type de la pièce"),
  surface_m2: z.number().optional().describe("Surface de la pièce en m²"),
  label_affiche: z.string().optional().describe("Nom affiché (ex: 'Chambre bleue')"),
});

// Schéma pour mettre à jour le profil propriétaire
export const updateOwnerProfileSchema = z.object({
  type: z.enum(["particulier", "societe"]).describe("Le type de propriétaire (particulier ou société)"),
  raison_sociale: z.string().optional().describe("Le nom de la société (SCI, SARL...)"),
  siret: z.string().optional().describe("Le numéro SIRET (14 chiffres)"),
  tva: z.string().optional().describe("Le numéro de TVA intracommunautaire"),
});

// Schéma pour créer un ticket de maintenance
export const createTicketSchema = z.object({
  titre: z.string().describe("Titre court du problème (ex: Fuite d'eau cuisine)"),
  description: z.string().describe("Description détaillée du problème"),
  priorite: z.enum(["basse", "normale", "haute"]).describe("Niveau d'urgence estimé"),
  localisation: z.string().optional().describe("Pièce ou endroit concerné (ex: Cuisine, SDB)"),
});

export type UpdatePropertyArgs = z.infer<typeof updatePropertySchema>;
export type AddRoomArgs = z.infer<typeof addRoomSchema>;
export type UpdateOwnerProfileArgs = z.infer<typeof updateOwnerProfileSchema>;
export type CreateTicketArgs = z.infer<typeof createTicketSchema>;
