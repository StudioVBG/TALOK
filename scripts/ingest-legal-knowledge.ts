/**
 * Script d'ingestion des connaissances juridiques
 * SOTA 2026 - RAG pour la gestion locative
 * 
 * Ce script peuple la base vectorielle avec :
 * - La loi ALUR et ses décrets d'application
 * - La loi du 6 juillet 1989
 * - Les règles sur le dépôt de garantie, les charges, etc.
 * 
 * Usage: npx tsx scripts/ingest-legal-knowledge.ts
 */

import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Variables d'environnement manquantes");
  console.error("   NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  dimensions: 1536,
});

// ============================================
// DONNÉES JURIDIQUES - LOI ALUR & AUTRES
// ============================================

interface LegalKnowledge {
  content: string;
  category: string;
  sourceTitle: string;
  articleReference?: string;
}

const LEGAL_KNOWLEDGE: LegalKnowledge[] = [
  // ============================================
  // DÉPÔT DE GARANTIE
  // ============================================
  {
    category: "depot_garantie",
    sourceTitle: "Loi du 6 juillet 1989",
    articleReference: "Article 22",
    content: `Le dépôt de garantie est limité à :
- 1 mois de loyer hors charges pour une location nue
- 2 mois de loyer hors charges pour une location meublée

Restitution du dépôt de garantie :
- Délai de 1 mois si l'état des lieux de sortie est conforme à l'état des lieux d'entrée
- Délai de 2 mois si des dégradations sont constatées
- En cas de retard, le dépôt est majoré de 10% du loyer mensuel pour chaque mois de retard

Les retenues sur le dépôt de garantie doivent être justifiées par des documents (factures, devis, photos de l'état des lieux).`,
  },
  {
    category: "depot_garantie",
    sourceTitle: "Jurisprudence",
    content: `Le propriétaire ne peut pas retenir le dépôt de garantie pour :
- L'usure normale du logement
- Les travaux de remise en état suite à vétusté
- Les menues réparations d'entretien courant qui incombent au locataire pendant le bail

La vétusté est définie comme l'état d'usure ou de détérioration résultant du temps ou de l'usage normal des matériaux et éléments d'équipement. Une grille de vétusté peut être annexée au contrat de bail.`,
  },

  // ============================================
  // PRÉAVIS ET CONGÉ
  // ============================================
  {
    category: "conge",
    sourceTitle: "Loi du 6 juillet 1989",
    articleReference: "Article 15",
    content: `Délais de préavis pour le locataire :

Location nue :
- 3 mois de préavis (cas général)
- 1 mois de préavis en zone tendue (liste fixée par décret)
- 1 mois de préavis pour : mutation professionnelle, perte d'emploi, nouvel emploi suite à perte d'emploi, état de santé justifiant un changement de domicile, bénéficiaire du RSA ou AAH, locataire de plus de 60 ans dont l'état de santé justifie un changement

Location meublée :
- 1 mois de préavis dans tous les cas

Le préavis court à compter de la réception de la lettre recommandée avec AR, de la signification par huissier, ou de la remise en main propre contre récépissé.`,
  },
  {
    category: "conge",
    sourceTitle: "Loi du 6 juillet 1989",
    articleReference: "Article 15",
    content: `Congé donné par le propriétaire :

Le bailleur peut donner congé à son locataire uniquement pour :
1. Vente du logement (droit de préemption du locataire)
2. Reprise pour habiter (lui-même ou famille proche)
3. Motif légitime et sérieux (impayés, troubles de voisinage)

Délais de préavis du bailleur :
- 6 mois avant l'échéance du bail en location nue
- 3 mois avant l'échéance du bail en meublé

Le congé doit être motivé et indiquer les nom et adresse du bénéficiaire de la reprise. Le congé frauduleux expose le bailleur à des dommages et intérêts.`,
  },

  // ============================================
  // CHARGES LOCATIVES
  // ============================================
  {
    category: "charges",
    sourceTitle: "Décret du 26 août 1987",
    content: `Les charges récupérables comprennent :

1. Ascenseur et monte-charge : électricité, entretien courant, menues réparations
2. Eau froide, eau chaude, chauffage collectif
3. Installations individuelles : entretien chaudière, robinetterie
4. Parties communes intérieures : électricité, produits d'entretien, entretien des espaces verts
5. Hygiène : conteneurs à ordures, dératisation, désinsectisation
6. Équipements divers : digicode, interphone, antenne TV
7. Taxes et redevances : enlèvement des ordures ménagères, balayage

La régularisation des charges doit avoir lieu au moins une fois par an, avec envoi du décompte détaillé au locataire.`,
  },
  {
    category: "charges",
    sourceTitle: "Loi ALUR",
    articleReference: "Article 23",
    content: `Provisions sur charges :

Le bailleur peut demander des provisions mensuelles sur charges. 
Leur montant doit correspondre aux dépenses réelles de l'année précédente.

La régularisation annuelle :
- Compare le montant des provisions versées aux dépenses réelles
- Donne lieu à un remboursement ou un complément
- Le bailleur doit communiquer le récapitulatif des charges 1 mois avant la régularisation
- Les pièces justificatives doivent être tenues à disposition du locataire pendant 6 mois

En copropriété, la régularisation peut être différée jusqu'à l'approbation des comptes de l'immeuble.`,
  },

  // ============================================
  // RÉPARATIONS LOCATIVES
  // ============================================
  {
    category: "travaux",
    sourceTitle: "Décret du 26 août 1987",
    content: `Réparations à la charge du locataire (réparations locatives) :

Parties extérieures :
- Entretien courant des jardins privatifs
- Menues réparations des auvents, terrasses, marquises
- Remplacement des vitres

Ouvertures intérieures et extérieures :
- Graissage des gonds et charnières
- Menues réparations des mécanismes de fermeture
- Remplacement des clés, badges, télécommandes

Parties intérieures :
- Maintien en état de propreté des murs, sols, plafonds
- Menus raccords de peinture et papiers peints
- Entretien courant des parquets

Installations de plomberie :
- Dégorgement des canalisations
- Remplacement des joints et colliers
- Entretien de la robinetterie`,
  },
  {
    category: "travaux",
    sourceTitle: "Loi du 6 juillet 1989",
    articleReference: "Article 6",
    content: `Obligations du bailleur en matière de travaux :

Le bailleur est tenu de :
1. Délivrer un logement décent
2. Remettre au locataire un logement en bon état d'usage
3. Entretenir les locaux et faire les réparations nécessaires (autres que locatives)
4. Assurer la jouissance paisible du logement

Travaux à charge du propriétaire :
- Gros œuvre (toiture, murs, fondations)
- Canalisations principales
- Chauffage central (sauf entretien courant)
- Installation électrique et gaz (mise aux normes)
- Remplacement des équipements vétustes

Le propriétaire doit informer le locataire des travaux prévus. Le locataire peut demander une réduction de loyer pour les travaux durant plus de 21 jours.`,
  },

  // ============================================
  // DÉCENCE DU LOGEMENT
  // ============================================
  {
    category: "decret_decence",
    sourceTitle: "Décret du 30 janvier 2002",
    content: `Critères de décence du logement :

Surface et volume :
- Surface habitable d'au moins 9 m² avec hauteur sous plafond de 2,20 m minimum
- Ou volume habitable d'au moins 20 m³

Sécurité physique et santé :
- Protection contre les infiltrations d'eau et remontées d'humidité
- Étanchéité à l'air
- Garde-corps aux fenêtres, escaliers, balcons
- Matériaux de construction conformes
- Réseaux et branchements en bon état

Équipements obligatoires :
- Chauffage adapté
- Alimentation en eau potable avec pression suffisante
- Évacuation des eaux usées
- Cuisine ou coin cuisine avec évier
- Installation sanitaire avec WC séparé de la cuisine
- Électricité suffisante pour l'éclairage et les appareils ménagers

Performance énergétique (depuis 2023) :
- Consommation d'énergie finale inférieure à 450 kWh/m²/an
- Interdiction de louer les "passoires thermiques" classe G (2025), F (2028), E (2034)`,
  },

  // ============================================
  // INDEXATION DU LOYER (IRL)
  // ============================================
  {
    category: "indexation",
    sourceTitle: "Loi du 6 juillet 1989",
    articleReference: "Article 17-1",
    content: `Révision annuelle du loyer :

Conditions :
- La clause de révision doit être prévue dans le bail
- La révision ne peut excéder la variation de l'Indice de Référence des Loyers (IRL)
- La révision a lieu à la date anniversaire du bail (ou date prévue au contrat)

Formule de calcul :
Nouveau loyer = Loyer actuel × (Nouvel IRL / Ancien IRL)

L'IRL est publié chaque trimestre par l'INSEE.

Prescription :
- Le bailleur dispose d'un an pour appliquer la révision
- Au-delà, la révision est perdue pour l'année concernée
- La révision ne peut pas être rétroactive

En zone tendue, le loyer est encadré et ne peut pas dépasser un plafond fixé par arrêté préfectoral.`,
  },

  // ============================================
  // ÉTAT DES LIEUX
  // ============================================
  {
    category: "edl",
    sourceTitle: "Loi ALUR",
    articleReference: "Article 3-2",
    content: `État des lieux d'entrée et de sortie :

Forme :
- Établi contradictoirement et amiablement par les parties
- Document écrit, daté et signé
- Remis à chaque partie (original ou copie)
- Peut être réalisé par un huissier (frais partagés pour l'entrée)

Contenu obligatoire :
- Type d'état des lieux (entrée ou sortie)
- Date d'établissement
- Localisation du logement
- Nom des parties et du mandataire éventuel
- Relevés des compteurs (eau, électricité, gaz)
- Description précise de chaque pièce (murs, sols, plafonds, équipements)
- Clés remises

Différences entre entrée et sortie :
- L'état des lieux de sortie est comparé à celui d'entrée
- Les différences doivent être distinguées de la vétusté normale
- En cas de désaccord, un huissier peut être mandaté (frais partagés)
- L'absence d'EDL d'entrée fait présumer que le logement était en bon état`,
  },

  // ============================================
  // LOI ALUR GÉNÉRALITÉS
  // ============================================
  {
    category: "loi_alur",
    sourceTitle: "Loi ALUR du 24 mars 2014",
    content: `La loi ALUR (Accès au Logement et un Urbanisme Rénové) a modernisé la réglementation locative :

Principales mesures :
1. Encadrement des loyers en zone tendue
2. Plafonnement des honoraires d'agence à la charge du locataire
3. Modèle type de contrat de bail
4. Liste limitative des documents demandables au locataire
5. Délai de préavis réduit à 1 mois en zone tendue
6. État des lieux type avec grille de vétusté
7. Garantie Universelle des Loyers (GUL) - non mise en œuvre

Documents interdits à la demande :
- Relevé de compte bancaire
- Attestation de bonne tenue de compte
- Attestation d'absence de crédit
- Carte d'assuré social
- Contrat de mariage (sauf demande de cautionnement)
- Jugement de divorce
- Dossier médical

Sanctions :
L'agent immobilier ou le bailleur qui demande des documents interdits s'expose à une amende de 3 000 € (personne physique) à 15 000 € (personne morale).`,
  },

  // ============================================
  // BAIL TYPE
  // ============================================
  {
    category: "bail_type",
    sourceTitle: "Décret du 29 mai 2015",
    content: `Bail de location nue - Mentions obligatoires :

Parties :
- Nom et adresse du bailleur
- Nom du locataire
- Date de prise d'effet et durée du bail

Logement :
- Consistance et destination du logement
- Surface habitable
- Description des locaux et équipements à usage privatif et commun
- Nature et montant des travaux effectués depuis le dernier bail

Conditions financières :
- Montant du loyer et modalités de paiement
- Montant du dernier loyer acquitté par le précédent locataire
- Modalités de révision du loyer
- Montant du dépôt de garantie
- Montant et nature des charges

Annexes obligatoires :
- Notice d'information
- État des lieux d'entrée
- Diagnostics techniques (DPE, plomb, amiante, etc.)
- Règlement de copropriété (extraits)
- Attestation d'assurance du locataire`,
  },
  {
    category: "bail_type",
    sourceTitle: "Loi du 6 juillet 1989",
    content: `Types de baux et durées :

Location nue à titre de résidence principale :
- Durée minimale : 3 ans (bailleur personne physique) ou 6 ans (personne morale)
- Renouvellement tacite pour la même durée
- Bail dérogatoire de 1 an possible si motif légitime (mutation, retraite)

Location meublée à titre de résidence principale :
- Durée minimale : 1 an (9 mois pour un étudiant)
- Renouvellement tacite pour 1 an
- Le logement doit contenir un mobilier minimum (liste décret)

Bail mobilité :
- Durée de 1 à 10 mois, non renouvelable
- Réservé aux étudiants, stagiaires, apprentis, personnes en mutation
- Pas de dépôt de garantie

Colocation :
- Bail unique avec clause de solidarité possible
- Ou baux individuels par colocataire
- Solidarité cesse 6 mois après le départ du colocataire`,
  },

  // ============================================
  // ASSURANCE
  // ============================================
  {
    category: "assurance",
    sourceTitle: "Loi du 6 juillet 1989",
    articleReference: "Article 7",
    content: `Assurance habitation du locataire :

Obligation :
- Le locataire doit s'assurer contre les risques locatifs (incendie, dégât des eaux, explosion)
- L'attestation d'assurance doit être remise au bailleur à la demande et chaque année

Défaut d'assurance :
- Le bailleur peut souscrire une assurance pour le compte du locataire et lui répercuter le coût
- Ou résilier le bail après mise en demeure restée sans effet pendant 1 mois

Clause résolutoire :
- Le bail peut prévoir une clause résolutoire pour défaut d'assurance
- La résiliation est acquise 1 mois après un commandement de justifier de l'assurance

Assurance propriétaire non occupant (PNO) :
- Non obligatoire mais fortement recommandée
- Couvre les sinistres en période de vacance locative
- Complète l'assurance du locataire
- Obligatoire en copropriété (loi ALUR)`,
  },

  // ============================================
  // IMPAYÉS
  // ============================================
  {
    category: "loi_alur",
    sourceTitle: "Procédure d'expulsion",
    content: `Procédure en cas d'impayé de loyer :

1. Dès le premier impayé :
- Contacter le locataire (téléphone, mail, courrier simple)
- Proposer un échéancier si difficultés temporaires
- Alerter la CAF si le locataire perçoit des APL

2. Mise en demeure :
- Lettre recommandée avec AR demandant le paiement sous 8 jours
- Préciser le montant dû et les pénalités de retard prévues au bail

3. Commandement de payer :
- Par acte d'huissier
- Délai de 2 mois pour régulariser
- Signalement au Fonds de Solidarité pour le Logement (FSL)

4. Assignation au tribunal :
- Si pas de régularisation après le commandement
- Saisine du juge des contentieux de la protection
- Demande de résiliation du bail et expulsion

5. Jugement et expulsion :
- Le juge peut accorder des délais de paiement (jusqu'à 3 ans)
- L'expulsion ne peut avoir lieu pendant la trêve hivernale (1er novembre - 31 mars)
- Concours de la force publique si nécessaire

Prévention :
- Visale : garantie gratuite pour les jeunes de moins de 30 ans
- GLI : Garantie Loyers Impayés (assurance propriétaire)`,
  },

  // ============================================
  // COPROPRIÉTÉ
  // ============================================
  {
    category: "copropriete",
    sourceTitle: "Loi du 10 juillet 1965",
    content: `Règles de copropriété pour les bailleurs :

Charges de copropriété :
- Charges générales : entretien des parties communes, proportionnelles aux tantièmes
- Charges spéciales : liées à l'utilisation (ascenseur, chauffage collectif)
- Certaines charges sont récupérables sur le locataire

Travaux :
- Travaux d'entretien : décidés par le syndic ou l'AG à majorité simple
- Travaux d'amélioration : majorité absolue (article 25) ou double majorité (article 26)
- Le propriétaire vote à l'AG, pas le locataire

Informations au locataire :
- Fournir les extraits du règlement de copropriété concernant :
  - La destination de l'immeuble
  - La jouissance des parties privatives et communes
  - La quote-part des charges

Fonds travaux (loi ALUR) :
- Obligatoire depuis 2017
- Cotisation annuelle minimale de 5% du budget prévisionnel
- Attaché au lot, non récupérable sur le locataire`,
  },

  // ============================================
  // FISCALITÉ
  // ============================================
  {
    category: "fiscalite",
    sourceTitle: "Code Général des Impôts",
    content: `Fiscalité des revenus locatifs :

Régime micro-foncier (location nue) :
- Recettes brutes < 15 000 €/an
- Abattement forfaitaire de 30%
- Déclaration simplifiée

Régime réel (location nue) :
- Obligatoire si recettes > 15 000 € ou sur option
- Déduction des charges réelles (travaux, intérêts d'emprunt, assurance, etc.)
- Possibilité de déficit foncier imputable sur le revenu global (plafond 10 700 €)

Régime micro-BIC (location meublée) :
- Recettes < 77 700 €/an
- Abattement forfaitaire de 50%

Régime réel BIC (location meublée) :
- Déduction des charges + amortissement du bien et du mobilier
- Statut LMNP (non professionnel) ou LMP (professionnel)

Prélèvements sociaux :
- 17,2% sur les revenus fonciers nets
- Contribution exceptionnelle sur les hauts revenus le cas échéant

Dispositifs de défiscalisation :
- Pinel, Denormandie, Loc'Avantages, Malraux, Monuments Historiques`,
  },
];

// ============================================
// FAQ ET BONNES PRATIQUES
// ============================================

interface PlatformKnowledge {
  title: string;
  content: string;
  knowledgeType: string;
  targetRoles: string[];
}

const PLATFORM_KNOWLEDGE: PlatformKnowledge[] = [
  {
    title: "Comment réviser le loyer chaque année ?",
    content: `Pour réviser le loyer annuellement :
1. Vérifiez que la clause de révision est présente dans le bail
2. Notez la date anniversaire du bail
3. Consultez l'IRL du trimestre de référence sur le site de l'INSEE
4. Appliquez la formule : Nouveau loyer = Loyer actuel × (Nouvel IRL / Ancien IRL)
5. Informez le locataire par courrier ou email
6. La révision s'applique à partir de la date anniversaire, sans effet rétroactif`,
    knowledgeType: "tutorial",
    targetRoles: ["owner"],
  },
  {
    title: "Que faire en cas de loyer impayé ?",
    content: `Procédure recommandée en cas d'impayé :
1. Contactez rapidement le locataire pour comprendre la situation
2. Proposez un échéancier si difficultés temporaires
3. Envoyez une mise en demeure par LRAR si pas de réponse
4. Faites délivrer un commandement de payer par huissier (délai 2 mois)
5. Si pas de régularisation, assignez devant le tribunal
6. Pensez à saisir la CAF si le locataire perçoit des APL
7. Déclarez la dette au Fonds de Solidarité Logement (FSL)`,
    knowledgeType: "tutorial",
    targetRoles: ["owner"],
  },
  {
    title: "Comment réaliser un état des lieux ?",
    content: `Bonnes pratiques pour l'état des lieux :
1. Réalisez-le en journée avec un bon éclairage
2. Testez tous les équipements (robinets, prises, volets, etc.)
3. Prenez des photos horodatées de chaque pièce et défaut
4. Relevez les compteurs (eau, électricité, gaz)
5. Notez le nombre de clés remises
6. Soyez précis sur l'état : neuf, bon état, état d'usage, mauvais état
7. Faites signer les deux parties sur place
8. Remettez un exemplaire au locataire immédiatement`,
    knowledgeType: "best_practice",
    targetRoles: ["owner", "tenant"],
  },
  {
    title: "Quels documents demander à un candidat locataire ?",
    content: `Documents autorisés par la loi ALUR :
1. Pièce d'identité en cours de validité
2. Justificatif de domicile (quittances, attestation hébergement)
3. Justificatifs d'activité (contrat de travail, extrait Kbis, carte étudiant)
4. Justificatifs de ressources (3 derniers bulletins de salaire, dernier avis d'imposition)
5. Si garant : mêmes documents + justificatif de lien avec le candidat

Documents INTERDITS :
- Photo d'identité, carte Vitale, relevé de compte, attestation de bonne tenue de compte
- Contrat de mariage, jugement de divorce, extrait de casier judiciaire
- Dossier médical personnel`,
    knowledgeType: "best_practice",
    targetRoles: ["owner"],
  },
  {
    title: "Quand puis-je récupérer mon logement ?",
    content: `Conditions de reprise du logement par le propriétaire :
1. Reprise pour habiter : vous ou votre famille proche (conjoint, ascendants, descendants)
2. Reprise pour vendre : le locataire a un droit de préemption
3. Motif légitime et sérieux : impayés répétés, troubles du voisinage

Délais de préavis du bailleur :
- 6 mois avant la fin du bail en location nue
- 3 mois avant la fin du bail en meublé

Le congé doit être motivé et envoyé par LRAR ou signifié par huissier.
Un congé frauduleux expose à des dommages et intérêts.`,
    knowledgeType: "faq",
    targetRoles: ["owner"],
  },
];

// ============================================
// FONCTIONS D'INGESTION
// ============================================

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddings.embedQuery(text);
  return result;
}

async function ingestLegalKnowledge() {
  console.log("📚 Ingestion des connaissances juridiques...\n");

  let success = 0;
  let failed = 0;

  for (const doc of LEGAL_KNOWLEDGE) {
    try {
      console.log(`  📄 ${doc.sourceTitle} - ${doc.category}`);

      const embedding = await generateEmbedding(doc.content);

      const { error } = await supabase.from("legal_embeddings").upsert(
        {
          content: doc.content,
          category: doc.category,
          source_title: doc.sourceTitle,
          article_reference: doc.articleReference,
          embedding,
          metadata: {},
        },
        {
          onConflict: "content",
          ignoreDuplicates: true,
        }
      );

      if (error) {
        console.error(`     ❌ Erreur: ${error.message}`);
        failed++;
      } else {
        console.log(`     ✅ OK`);
        success++;
      }

      // Pause pour éviter le rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`     ❌ Exception: ${error}`);
      failed++;
    }
  }

  console.log(`\n📊 Résultat: ${success} succès, ${failed} échecs`);
  return { success, failed };
}

async function ingestPlatformKnowledge() {
  console.log("\n💡 Ingestion des connaissances plateforme...\n");

  let success = 0;
  let failed = 0;

  for (const doc of PLATFORM_KNOWLEDGE) {
    try {
      console.log(`  📄 ${doc.title}`);

      const embedding = await generateEmbedding(doc.content);

      const { error } = await supabase.from("platform_knowledge").upsert(
        {
          title: doc.title,
          content: doc.content,
          knowledge_type: doc.knowledgeType,
          target_roles: doc.targetRoles,
          embedding,
          metadata: {},
        },
        {
          onConflict: "title",
          ignoreDuplicates: true,
        }
      );

      if (error) {
        console.error(`     ❌ Erreur: ${error.message}`);
        failed++;
      } else {
        console.log(`     ✅ OK`);
        success++;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`     ❌ Exception: ${error}`);
      failed++;
    }
  }

  console.log(`\n📊 Résultat: ${success} succès, ${failed} échecs`);
  return { success, failed };
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🚀 Démarrage de l'ingestion RAG\n");
  console.log("=".repeat(50));

  const legalResult = await ingestLegalKnowledge();
  const platformResult = await ingestPlatformKnowledge();

  console.log("\n" + "=".repeat(50));
  console.log("✅ Ingestion terminée !");
  console.log(`   - Documents juridiques: ${legalResult.success}/${LEGAL_KNOWLEDGE.length}`);
  console.log(`   - Connaissances plateforme: ${platformResult.success}/${PLATFORM_KNOWLEDGE.length}`);
}

main().catch(console.error);

