// @ts-nocheck
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { updatePropertySchema, addRoomSchema, updateOwnerProfileSchema, createTicketSchema } from '@/lib/ai/tools-schema';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, context } = await req.json(); // 'context' permet de savoir où on est (property ou onboarding)

  // Prompt dynamique selon le contexte
  let systemPrompt = `Tu es Tom, l'assistant intelligent de l'application de gestion locative.
    Tu es sympathique, efficace et proactif. Tu tutoies l'utilisateur de manière respectueuse.
  `;

  if (context === 'onboarding_owner') {
    systemPrompt += `
    CONTEXTE : L'utilisateur vient de s'inscrire et doit configurer son profil propriétaire.
    
    TES OBJECTIFS :
    1. Demander s'il est un particulier ou une société (SCI, etc.).
    2. S'il est une société, demander le nom (Raison sociale) et le SIRET.
    3. Remplir le profil avec l'outil 'updateOwnerProfile'.
    
    RÈGLES :
    - Sois accueillant ("Bienvenue ! Commençons par configurer votre compte.").
    - Une fois les infos obtenues, confirme et dis que c'est enregistré.
    `;
  } else if (context === 'maintenance_ticket') {
    systemPrompt += `
    CONTEXTE : L'utilisateur (locataire) signale un problème dans son logement.
    
    TES OBJECTIFS :
    1. Comprendre le problème.
    2. Diagnostiquer l'urgence (Fuite d'eau = Haute, Ampoule = Basse).
    3. Suggérer une action immédiate si nécessaire (ex: "Coupez l'eau au général").
    4. Créer le ticket avec l'outil 'createTicket'.
    
    RÈGLES :
    - Demande des détails si c'est flou ("Ça fuit d'où exactement ?").
    - Rassure l'utilisateur si c'est urgent.
    `;
  } else {
    // Par défaut : Création de bien
    systemPrompt += `
    CONTEXTE : L'utilisateur est en train de créer une annonce de bien immobilier.
    
    TES CAPACITÉS :
    1. Tu peux remplir le formulaire à la place de l'utilisateur.
    2. Tu peux ajouter des pièces (chambres, salon, etc.).
    3. Si l'utilisateur donne une description vague (ex: "T3 à Paris"), pose des questions pour préciser (surface, loyer, étage, meublé ?).
    4. NE DEMANDE PAS tout d'un coup. Remplis ce que tu peux, puis demande le reste.
    
    RÈGLES IMPORTANTES :
    - Appelle l'outil 'updateProperty' dès que tu détectes des infos sur le bien (loyer, surface, adresse, type).
    - Appelle l'outil 'addRoom' si l'utilisateur mentionne des pièces spécifiques (ex: "il y a 2 chambres de 12m2").
    - Sois concis. Confirme les actions par une phrase courte (ex: "C'est noté, j'ai mis à jour le loyer.").
    `;
  }

  const result = await streamText({
    // @ts-expect-error - Incompatibilité temporaire entre versions du SDK
    model: openai('gpt-4o'),
    messages,
    system: systemPrompt,
    tools: {
      updateProperty: {
        description: 'Met à jour les informations générales du bien (surface, loyer, adresse, etc.)',
        parameters: updatePropertySchema,
      },
      addRoom: {
        description: 'Ajoute une pièce au bien (chambre, salon, etc.)',
        parameters: addRoomSchema,
      },
      updateOwnerProfile: {
        description: 'Met à jour les informations du profil propriétaire (type, siret, raison sociale)',
        parameters: updateOwnerProfileSchema,
      },
      createTicket: {
        description: 'Crée un ticket de maintenance qualifié',
        parameters: createTicketSchema,
      },
    },
  });

  return result.toDataStreamResponse();
}
