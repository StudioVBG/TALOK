import type { LegalProtocol, ProtocolType } from "@/lib/types/legal-protocols";

/**
 * Protocole Anti-Squat pour Propriétaires
 * Basé sur la loi du 27 juillet 2023 (Kasbarian-Bergé)
 */
export const PROTOCOL_ANTI_SQUAT_OWNER: LegalProtocol = {
  id: "anti_squat_owner",
  title: "Protocole Anti-Squat",
  subtitle: "Procédure légale pour propriétaires victimes de squat",
  icon: "🛡️",
  target_role: "owner",
  legal_source: "Loi n° 2023-668 du 27 juillet 2023 (anti-squat Kasbarian-Bergé)",
  last_updated: "2025-01-01",
  
  steps: [
    {
      id: "step_1_immediate",
      order: 1,
      title: "⚠️ Actions immédiates interdites",
      description: "Ce qu'il ne faut JAMAIS faire, sous peine de condamnation pénale",
      priority: "critique",
      estimated_duration: "Lecture : 2 min",
      legal_reference: "Article 226-4-2 Code pénal",
      warning: "Violation = jusqu'à 3 ans de prison et 30 000 € d'amende",
      detailed_actions: [],
      forbidden_actions: [
        "❌ Changer la serrure vous-même",
        "❌ Couper l'eau, le gaz ou l'électricité",
        "❌ Enlever ou jeter les affaires des occupants",
        "❌ Entrer par la force dans le logement",
        "❌ Menacer, intimider ou violenter les occupants",
        "❌ Faire intervenir des amis/famille pour déloger",
        "❌ Toute action de \"justice personnelle\""
      ],
      documents: [],
      contacts: []
    },
    {
      id: "step_2_police",
      order: 2,
      title: "🚨 Alerter les forces de l'ordre",
      description: "Signalement immédiat du squat à la police/gendarmerie",
      priority: "critique",
      estimated_duration: "1-2 heures",
      deadline_info: "Agir dans les 48h pour maximiser les chances d'évacuation rapide",
      detailed_actions: [
        "Appeler le 17 ou se rendre au commissariat/gendarmerie",
        "Expliquer : occupation sans droit ni titre, effraction, serrure changée",
        "Demander une intervention pour constater la violation de domicile",
        "Demander un récépissé de votre signalement",
        "En cas de flagrance (squat récent), la police peut évacuer immédiatement"
      ],
      documents: [],
      contacts: [
        {
          role: "Police / Gendarmerie",
          phone: "17",
          notes: "Numéro d'urgence, disponible 24h/24"
        },
        {
          role: "Police municipale",
          notes: "Peut intervenir en complément selon les communes"
        }
      ]
    },
    {
      id: "step_3_plainte",
      order: 3,
      title: "📝 Déposer plainte pour violation de domicile",
      description: "Plainte pénale officielle avec preuves de propriété/occupation",
      priority: "critique",
      estimated_duration: "1-2 heures",
      legal_reference: "Article 226-4 Code pénal (3 ans prison, 45 000 € amende)",
      detailed_actions: [
        "Se rendre au commissariat ou gendarmerie",
        "Qualifier les faits : violation de domicile (art. 226-4 CP)",
        "Joindre toutes les preuves de propriété/occupation",
        "Demander une copie de la plainte (indispensable pour la suite)",
        "Accéder à Ma Sécurité pour déposer une plainte en ligne : masecurite.interieur.gouv.fr"
      ],
      documents: [
        {
          id: "titre_propriete",
          name: "Titre de propriété / Attestation notariale",
          description: "Preuve que vous êtes propriétaire du bien",
          required: true
        },
        {
          id: "taxe_fonciere",
          name: "Avis de taxe foncière",
          description: "À votre nom et adresse du bien",
          required: true
        },
        {
          id: "factures",
          name: "Factures EDF/Eau/Internet",
          description: "À votre nom, prouvant l'occupation légitime",
          required: true
        },
        {
          id: "assurance",
          name: "Attestation d'assurance habitation",
          description: "PNO ou habitation à votre nom",
          required: true
        },
        {
          id: "photos",
          name: "Photos de vos meubles/affaires",
          description: "Prouvant que c'est votre domicile",
          required: false
        },
        {
          id: "temoignages",
          name: "Attestations de voisins",
          description: "Confirmant que vous habitiez les lieux",
          required: false
        }
      ],
      contacts: [
        {
          role: "Ma Sécurité (Ministère de l'Intérieur)",
          url: "https://www.masecurite.interieur.gouv.fr/fr",
          notes: "Plateforme officielle pour déposer plainte en ligne et signaler un squat"
        }
      ]
    },
    {
      id: "step_4_prefet",
      order: 4,
      title: "🏛️ Demande d'évacuation forcée au Préfet",
      description: "Procédure administrative accélérée (article 38 loi DALO)",
      priority: "critique",
      estimated_duration: "Rédaction : 1h | Réponse préfecture : 48h",
      deadline_info: "Préfet doit répondre sous 48h selon la loi",
      legal_reference: "Article 38 loi DALO + Circulaire 2024",
      detailed_actions: [
        "Rédiger un courrier au Préfet demandant l'évacuation forcée",
        "Citer explicitement l'article 38 de la loi DALO",
        "Joindre copie de la plainte + preuves de domicile",
        "Joindre constat d'occupation (huissier ou police)",
        "Envoyer en recommandé AR à la préfecture",
        "Le préfet peut mettre en demeure les squatteurs (24h minimum)",
        "Si refus de quitter : évacuation par forces de l'ordre"
      ],
      documents: [
        {
          id: "copie_plainte",
          name: "Copie de la plainte",
          description: "Plainte déposée à l'étape précédente",
          required: true
        },
        {
          id: "constat_huissier",
          name: "Constat d'huissier",
          description: "Constat de l'occupation illicite (recommandé)",
          required: false
        },
        {
          id: "preuves_domicile",
          name: "Preuves de domicile",
          description: "Même dossier que pour la plainte",
          required: true
        }
      ],
      contacts: [
        {
          role: "Préfectures",
          url: "https://www.prefectures-regions.gouv.fr",
          notes: "Trouver votre préfecture sur le site officiel"
        }
      ]
    },
    {
      id: "step_5_juge",
      order: 5,
      title: "⚖️ Saisir le juge (si préfet refuse/traîne)",
      description: "Voie judiciaire en référé si la procédure administrative échoue",
      priority: "important",
      estimated_duration: "Audience : 2-4 semaines",
      detailed_actions: [
        "Faire appel à un commissaire de justice (huissier) pour constat",
        "Saisir le Juge des Contentieux de la Protection (JCP) en référé",
        "Demander : constat d'occupation illicite + ordonnance d'expulsion",
        "Demander une indemnité d'occupation (équivalent loyer)",
        "Après jugement, l'huissier délivre un commandement de quitter",
        "En cas de refus, demande de concours de la force publique"
      ],
      documents: [
        {
          id: "constat_huissier_juge",
          name: "Constat d'huissier de justice",
          description: "Indispensable pour le tribunal",
          required: true
        },
        {
          id: "dossier_complet",
          name: "Dossier complet de preuves",
          description: "Toutes les preuves des étapes précédentes",
          required: true
        }
      ],
      contacts: [
        {
          role: "Chambre des Commissaires de Justice",
          url: "https://www.huissier-justice.fr",
          notes: "Trouver un huissier proche de chez vous"
        },
        {
          role: "Tribunal judiciaire",
          url: "https://www.justice.fr/recherche/annuaires",
          notes: "Annuaire des tribunaux"
        }
      ]
    },
    {
      id: "step_6_assurance",
      order: 6,
      title: "📞 Déclarer à l'assurance & se faire aider",
      description: "Protection juridique et indemnisation des dommages",
      priority: "important",
      estimated_duration: "Variable",
      detailed_actions: [
        "Prévenir votre assurance habitation (PNO si bailleur)",
        "Vérifier si votre contrat couvre le squat (perte de loyers, dégradations)",
        "Activer la protection juridique si incluse",
        "Contacter l'ADIL de votre département (conseil gratuit)",
        "Consulter un avocat spécialisé en droit immobilier",
        "Conserver tous les justificatifs de frais engagés"
      ],
      documents: [
        {
          id: "contrat_assurance",
          name: "Contrat d'assurance",
          description: "Pour vérifier les garanties couvertes",
          required: true
        }
      ],
      contacts: [
        {
          role: "ADIL (Agence Info Logement)",
          url: "https://www.anil.org/lanil-et-les-adil/votre-adil/",
          notes: "Conseil juridique gratuit dans chaque département"
        }
      ]
    }
  ],

  emergency_contacts: [
    {
      role: "Urgence Police/Gendarmerie",
      phone: "17",
      notes: "En cas de flagrant délit ou menace"
    },
    {
      role: "Numéro d'urgence européen",
      phone: "112",
      notes: "Alternative au 17"
    },
    {
      role: "Ma Sécurité (plateforme Ministère)",
      url: "https://www.masecurite.interieur.gouv.fr",
      notes: "Signalement et conseils en ligne"
    }
  ]
};

/**
 * Protocole Prévention Squat pour Propriétaires
 */
export const PROTOCOL_PREVENTION_OWNER: LegalProtocol = {
  id: "prevention_owner",
  title: "Prévention Anti-Squat",
  subtitle: "Mesures préventives pour protéger votre logement",
  icon: "🔒",
  target_role: "owner",
  legal_source: "Bonnes pratiques recommandées",
  last_updated: "2025-01-01",

  steps: [
    {
      id: "prev_1_securisation",
      order: 1,
      title: "🔐 Sécurisation physique du logement",
      description: "Renforcer les accès pour dissuader les intrusions",
      priority: "important",
      estimated_duration: "Variable selon travaux",
      detailed_actions: [
        "Installer des serrures multipoints (3 ou 5 points)",
        "Renforcer les portes (blindage si possible)",
        "Installer une alarme avec télésurveillance",
        "Mettre des détecteurs d'ouverture sur fenêtres/portes",
        "Prévoir un éclairage extérieur automatique",
        "Installer des timers pour simuler une présence (lumières, TV)"
      ],
      documents: [],
      contacts: []
    },
    {
      id: "prev_2_presence",
      order: 2,
      title: "👁️ Maintenir une présence visible",
      description: "Ne jamais laisser un logement paraître abandonné",
      priority: "important",
      estimated_duration: "Actions régulières",
      detailed_actions: [
        "Relever le courrier très régulièrement (boîte jamais pleine)",
        "Ouvrir et fermer les volets quotidiennement si possible",
        "Tondre le jardin, entretenir l'extérieur",
        "Demander à un voisin de confiance de surveiller",
        "Envisager un service de conciergerie si absence longue",
        "Visiter le bien au moins 1x/semaine si inoccupé"
      ],
      documents: [],
      contacts: []
    },
    {
      id: "prev_3_domicile",
      order: 3,
      title: "🏠 Faire exister juridiquement le domicile",
      description: "Preuves solides que le logement est occupé/meublé",
      priority: "critique",
      estimated_duration: "Mise en place ponctuelle",
      detailed_actions: [
        "Maintenir des meubles même si le logement est vide",
        "Garder les contrats EDF/eau/internet à votre nom et actifs",
        "Assurance habitation à jour avec adresse du bien",
        "Déclarer l'adresse aux impôts (avis d'imposition)",
        "Conserver photos datées de vos meubles/affaires",
        "Cela permet l'évacuation rapide si squat (domicile prouvé)"
      ],
      documents: [
        {
          id: "factures_actives",
          name: "Factures utilitaires à votre nom",
          description: "EDF, eau, internet actifs",
          required: true
        },
        {
          id: "photos_meublement",
          name: "Photos datées du logement meublé",
          description: "Preuves de domicile",
          required: true
        }
      ],
      contacts: []
    },
    {
      id: "prev_4_reaction",
      order: 4,
      title: "⚡ Réagir au moindre signe anormal",
      description: "Détection précoce = intervention rapide",
      priority: "important",
      estimated_duration: "Vigilance continue",
      detailed_actions: [
        "Voisins signalent du monde inhabituel → vérifier immédiatement",
        "Courrier qui s'accumule → aller sur place",
        "Compteurs modifiés, serrure changée → appeler police direct",
        "NE PAS attendre des jours/semaines pour agir",
        "En cas de doute, contacter un huissier pour constat rapide"
      ],
      documents: [],
      contacts: []
    },
    {
      id: "prev_5_legal",
      order: 5,
      title: "📋 Préparation juridique & assurance",
      description: "Avoir les ressources prêtes en cas de problème",
      priority: "recommandé",
      estimated_duration: "1-2 heures de préparation",
      detailed_actions: [
        "Souscrire une assurance PNO avec protection juridique",
        "Identifier un avocat spécialisé immobilier (contact prêt)",
        "Identifier un huissier proche du bien",
        "Conserver un dossier \"prêt à l'emploi\" avec toutes les preuves",
        "Connaître la procédure anti-squat (ce protocole !)"
      ],
      documents: [
        {
          id: "dossier_preuve",
          name: "Dossier de preuves prêt",
          description: "Titre, factures, photos, assurance...",
          required: true
        }
      ],
      contacts: [
        {
          role: "ADIL de votre département",
          url: "https://www.anil.org/lanil-et-les-adil/votre-adil/",
          notes: "Conseil juridique gratuit"
        }
      ]
    }
  ],

  emergency_contacts: []
};

/**
 * Protocole Protection Locataire
 * Contre les expulsions illégales par le propriétaire
 */
export const PROTOCOL_PROTECTION_TENANT: LegalProtocol = {
  id: "protection_tenant",
  title: "Protection Locataire",
  subtitle: "Vos droits face à une expulsion illégale ou un squat",
  icon: "🛡️",
  target_role: "tenant",
  legal_source: "Code pénal art. 226-4 & 226-4-2, Loi du 6 juillet 1989",
  last_updated: "2025-01-01",

  steps: [
    {
      id: "tenant_1_droits",
      order: 1,
      title: "⚖️ Connaître vos droits fondamentaux",
      description: "Un locataire avec bail a un droit au domicile aussi fort qu'un propriétaire",
      priority: "critique",
      estimated_duration: "Lecture : 5 min",
      legal_reference: "Article 226-4 Code pénal",
      detailed_actions: [
        "Votre bail = votre droit d'occuper le logement",
        "Le propriétaire NE PEUT PAS entrer sans votre accord",
        "Le propriétaire NE PEUT PAS changer la serrure (même impayés)",
        "Le propriétaire NE PEUT PAS couper eau/électricité",
        "Toute expulsion doit passer par le tribunal + huissier + préfet",
        "La trêve hivernale vous protège (1er nov - 31 mars)"
      ],
      warning: "Un propriétaire qui vous expulse de force commet un délit (3 ans prison, 30 000 € amende)",
      documents: [
        {
          id: "bail",
          name: "Votre bail de location",
          description: "Preuve de votre droit d'occupation",
          required: true
        }
      ],
      contacts: []
    },
    {
      id: "tenant_2_expulsion_illegale",
      order: 2,
      title: "🚨 Si votre propriétaire vous expulse illégalement",
      description: "Actions immédiates en cas de changement de serrure, coupure, etc.",
      priority: "critique",
      estimated_duration: "Urgence : agir immédiatement",
      detailed_actions: [
        "Appeler le 17 (police) IMMÉDIATEMENT",
        "Expliquer : votre propriétaire vous a expulsé illégalement",
        "Demander une intervention pour constater les faits",
        "Prendre des photos/vidéos : serrure changée, affaires dehors, etc.",
        "Récupérer des témoignages de voisins si possible",
        "Ne tentez PAS de forcer l'entrée vous-même"
      ],
      documents: [],
      contacts: [
        {
          role: "Police / Gendarmerie",
          phone: "17",
          notes: "Urgence expulsion illégale"
        }
      ]
    },
    {
      id: "tenant_3_plainte",
      order: 3,
      title: "📝 Déposer plainte contre le propriétaire",
      description: "Plainte pénale pour violation de domicile et expulsion illicite",
      priority: "critique",
      estimated_duration: "1-2 heures",
      legal_reference: "Articles 226-4 et 226-4-2 Code pénal",
      detailed_actions: [
        "Aller au commissariat déposer plainte",
        "Qualifier : violation de domicile + expulsion illicite",
        "Fournir copie du bail, quittances, preuves de paiement",
        "Joindre photos des faits, témoignages",
        "Demander une copie de la plainte"
      ],
      documents: [
        {
          id: "bail_locataire",
          name: "Bail de location",
          description: "Preuve de votre occupation légale",
          required: true
        },
        {
          id: "quittances",
          name: "Quittances de loyer",
          description: "Preuves de paiement des loyers",
          required: true
        },
        {
          id: "preuves_paiement",
          name: "Relevés bancaires / Virements",
          description: "Preuves des paiements effectués",
          required: true
        },
        {
          id: "photos_faits",
          name: "Photos des faits",
          description: "Serrure changée, affaires dehors, etc.",
          required: true
        }
      ],
      contacts: []
    },
    {
      id: "tenant_4_huissier",
      order: 4,
      title: "📋 Faire constater par huissier",
      description: "Constat officiel pour renforcer votre dossier",
      priority: "important",
      estimated_duration: "24-48h",
      detailed_actions: [
        "Contacter un commissaire de justice (huissier) en urgence",
        "Demander un constat de la situation (serrure, affaires, etc.)",
        "Ce constat a valeur de preuve devant le tribunal",
        "Coût : environ 150-300 € (récupérable sur le propriétaire)"
      ],
      documents: [],
      contacts: [
        {
          role: "Chambre des Commissaires de Justice",
          url: "https://www.huissier-justice.fr",
          notes: "Trouver un huissier en urgence"
        }
      ]
    },
    {
      id: "tenant_5_juge",
      order: 5,
      title: "⚖️ Saisir le juge en urgence (référé)",
      description: "Demander votre réintégration dans le logement",
      priority: "critique",
      estimated_duration: "Audience sous 1-2 semaines",
      detailed_actions: [
        "Saisir le Juge des Contentieux de la Protection (JCP) en référé",
        "Demander votre réintégration immédiate dans le logement",
        "Demander des dommages-intérêts (préjudice matériel + moral)",
        "Le juge peut ordonner la remise des clés sous astreinte",
        "Possibilité d'aide juridictionnelle si revenus modestes"
      ],
      documents: [
        {
          id: "dossier_complet_locataire",
          name: "Dossier complet",
          description: "Bail, plainte, constat, preuves",
          required: true
        }
      ],
      contacts: [
        {
          role: "Tribunal judiciaire",
          url: "https://www.justice.fr/recherche/annuaires",
          notes: "Trouver votre tribunal"
        },
        {
          role: "Aide juridictionnelle",
          url: "https://www.justice.fr/simulateurs/aide-juridictionnelle",
          notes: "Simulateur d'éligibilité"
        }
      ]
    },
    {
      id: "tenant_6_aide",
      order: 6,
      title: "🤝 Se faire accompagner",
      description: "Associations et ressources gratuites",
      priority: "important",
      estimated_duration: "Variable",
      detailed_actions: [
        "Contacter l'ADIL de votre département (gratuit)",
        "Contacter une association de locataires (CNL, CLCV, etc.)",
        "Demander l'aide juridictionnelle si revenus modestes",
        "Contacter le CCAS de votre mairie (hébergement d'urgence)",
        "Garder tous les justificatifs de frais (hôtel, etc.)"
      ],
      documents: [],
      contacts: [
        {
          role: "ADIL (Agence Info Logement)",
          url: "https://www.anil.org/lanil-et-les-adil/votre-adil/",
          notes: "Conseil gratuit"
        },
        {
          role: "CNL (Confédération Nationale du Logement)",
          url: "https://www.lacnl.com",
          notes: "Association de défense des locataires"
        },
        {
          role: "CLCV",
          url: "https://www.clcv.org",
          notes: "Association de consommateurs"
        },
        {
          role: "115 (SAMU Social)",
          phone: "115",
          notes: "Hébergement d'urgence"
        }
      ]
    },
    {
      id: "tenant_7_squat_tiers",
      order: 7,
      title: "🏠 Si un tiers squatte VOTRE logement loué",
      description: "Quand quelqu'un d'autre s'installe chez vous",
      priority: "important",
      estimated_duration: "Variable",
      detailed_actions: [
        "Vous êtes locataire légitime = même droits qu'un propriétaire",
        "Déposer plainte pour violation de domicile (art. 226-4 CP)",
        "Prévenir votre propriétaire immédiatement",
        "Suivre la même procédure que les propriétaires (préfet, juge)",
        "Le propriétaire peut se constituer partie civile pour les dégradations"
      ],
      documents: [],
      contacts: []
    }
  ],

  emergency_contacts: [
    {
      role: "Urgence Police",
      phone: "17",
      notes: "Expulsion illégale ou squat"
    },
    {
      role: "SAMU Social (hébergement)",
      phone: "115",
      notes: "Si vous êtes à la rue"
    },
    {
      role: "ADIL",
      url: "https://www.anil.org/lanil-et-les-adil/votre-adil/",
      notes: "Conseil juridique gratuit"
    }
  ]
};

// Export de tous les protocoles
export const ALL_PROTOCOLS: LegalProtocol[] = [
  PROTOCOL_ANTI_SQUAT_OWNER,
  PROTOCOL_PREVENTION_OWNER,
  PROTOCOL_PROTECTION_TENANT
];

export function getProtocolById(id: ProtocolType): LegalProtocol | undefined {
  return ALL_PROTOCOLS.find(p => p.id === id);
}

export function getProtocolsForRole(role: "owner" | "tenant"): LegalProtocol[] {
  return ALL_PROTOCOLS.filter(p => p.target_role === role || p.target_role === "both");
}

