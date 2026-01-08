# Architecture fonctionnelle SaaS Talok

```mermaid
graph TD

  %% Espace public

  subgraph PUBLIC["Espace public (non connecté)"]

    LP[Landing page & présentation offre]

    PB[Pages marketing (fonctionnalités, tarifs)]

    LIST[Liste des biens à louer]

    FICHE[Fiche bien / détails logement]

    BLOG[Blog & ressources conseils]

    HELP[FAQ & Centre d'aide]

  end



  %% Auth & onboarding

  subgraph AUTH["Authentification & Onboarding"]

    CONN[Connexion]

    INSCR[Inscription]

    ROLE[Choix du type de compte]

    WIZ_OWNER[Onboarding propriétaire]

    WIZ_TENANT[Onboarding locataire]

    WIZ_GUARANTOR[Onboarding garant]

    WIZ_VENDOR[Onboarding prestataire]

    SEC[2FA, sécurité, RGPD & consentements]

  end



  %% Propriétaire

  subgraph OWNER["Espace Propriétaire"]

    O_DASH[Dashboard propriétaire]

    O_PROFILE[Profil, KYC, société, IBAN, TVA]

    O_NOTIF[Préférences & notifications]

    O_PROPS[Gestion des biens & lots]

    O_UNITS[Biens : appart, maison, coloc, local com., parking]

    O_DOCS[Documents diagnostics & conformité]

    O_ADS[Publication annonces & diffusion OTAs]

    O_APPLIC[Demandes de location & candidatures]

    O_SCREEN[Score & sélection des dossiers]

    O_LEASE[Baux & signatures électroniques]

    O_RENT[Appels de loyers, charges, indexation]

    O_PAY[Encaissement paiements & relances]

    O_DEPOSIT[Dépôt de garantie & régularisation]

    O_EDL[État des lieux + photos entrée / sortie]

    O_TICKETS[Incidents & tickets maintenance]

    O_VENDOR[Demande d'intervention prestataires]

    O_COM[Messagerie avec locataire / garant / prestataire]

    O_REPORT[Dashboard financier & exports comptables]

    O_TAX[Aides déclarations fiscales (revenus fonciers, BIC…)]

    O_LIB[Bibliothèque documents (quittances, baux, EDL…)]

  end



  %% Locataire

  subgraph TENANT["Espace Locataire"]

    T_DASH[Dashboard locataire]

    T_PROFILE[Profil, foyer, situation pro & revenus]

    T_DOCS[Dossier locatif & pièces justificatives]

    T_SEARCH[Recherche & favoris des biens]

    T_APPLY[Candidatures & suivi d'avancement]

    T_LEASE[Signature bail & annexes]

    T_COLIV[Gestion colocation (parts loyer, colocataires)]

    T_RENT[Paiement loyer & charges]

    T_RECEIPT[Téléchargement quittances & docs]

    T_EDL[Préparation & validation état des lieux]

    T_INCIDENT[Déclaration anomalies / pannes]

    T_CHAT[Messagerie propriétaire / prestataire]

    T_ENERGY[Suivi compteurs & contrats énergie]

    T_INSURANCE[Attestation assurance habitation]

  end



  %% Garant

  subgraph GUARANTOR["Espace Garant"]

    G_DASH[Dashboard garant]

    G_PROFILE[Profil, KYC, revenus]

    G_LINK[Association avec locataire / bail]

    G_DOCS[Pièces justificatives & attestations]

    G_CONSENT[Acceptation engagement de garantie]

    G_FOLLOW[Suivi loyers garantis & notifications]

  end



  %% Prestataire / Service

  subgraph VENDOR["Espace Prestataire de services"]

    V_DASH[Dashboard prestataire]

    V_PROFILE[Profil, KYC, assurance RC]

    V_SERVICES[Catalogue services (plomberie, élec., ménage…)]

    V_ZONE[Zones d'intervention & disponibilité]

    V_QUOTES[Devis & validations]

    V_JOBS[Demandes d'intervention (tickets reçus)]

    V_PLANNING[Agenda interventions]

    V_INVOICES[Facturation & paiements]

    V_CHAT[Messagerie avec propriétaires / locataires]

  end



  %% Admin

  subgraph ADMIN["Espace Admin & Back-office"]

    A_DASH[Dashboard global KPIs]

    A_USERS[Gestion utilisateurs & rôles]

    A_PROPS[Vue globale des biens & baux]

    A_RISK[Contrôle fraude, KYC & conformité]

    A_API[Gestion & coûts des APIs externes]

    A_BILLING[Facturation plateforme & plans SaaS]

    A_SUPPORT[Support & escalade tickets]

    A_CONTENT[Pages contenus, blog & FAQ]

    A_CONF[Paramètres systèmes & templates docs]

    A_ANALYTICS[Analyse data (âge, typologie, loyers…)]

  end



  %% Modules transverses

  subgraph CORE["Modules transverses"]

    CORE_AUTH[Service Auth & rôles]

    CORE_ESIGN[Signature électronique eIDAS]

    CORE_PAY[Paiements (CB, SEPA, wallet…)]

    CORE_DOC[Générateur de documents (baux, EDL, quittances)]

    CORE_STORAGE[Stockage sécurisé des fichiers & photos]

    CORE_NOTIF[Notifications email / SMS / in-app]

    CORE_CHAT[Hub messagerie temps réel]

    CORE_API[Connecteurs OTAs, GLI, Assurances, Energie…]

    CORE_AI[Assistants IA & scoring dossiers]

  end



  %% Flux principaux

  LP --> PB

  LP --> LIST

  LIST --> FICHE

  FICHE --> INSCR

  LP --> INSCR

  LP --> CONN



  CONN --> CORE_AUTH

  INSCR --> ROLE

  ROLE --> WIZ_OWNER

  ROLE --> WIZ_TENANT

  ROLE --> WIZ_GUARANTOR

  ROLE --> WIZ_VENDOR

  ROLE --> SEC



  CORE_AUTH --> O_DASH

  CORE_AUTH --> T_DASH

  CORE_AUTH --> G_DASH

  CORE_AUTH --> V_DASH

  CORE_AUTH --> A_DASH



  %% Liens internes propriétaire

  O_DASH --> O_PROFILE

  O_DASH --> O_PROPS

  O_DASH --> O_REPORT

  O_DASH --> O_LIB

  O_DASH --> O_NOTIF



  O_PROPS --> O_UNITS

  O_PROPS --> O_DOCS

  O_PROPS --> O_ADS

  O_ADS --> O_APPLIC

  O_APPLIC --> O_SCREEN

  O_SCREEN --> CORE_AI

  O_SCREEN --> O_LEASE

  O_LEASE --> CORE_ESIGN

  O_LEASE --> O_DEPOSIT

  O_LEASE --> O_RENT

  O_RENT --> O_PAY

  O_PAY --> CORE_PAY

  O_EDL --> CORE_DOC

  O_EDL --> CORE_STORAGE

  O_TICKETS --> O_VENDOR

  O_VENDOR --> V_JOBS

  O_TICKETS --> O_COM

  O_COM --> CORE_CHAT

  O_REPORT --> A_ANALYTICS

  O_LIB --> CORE_STORAGE



  %% Liens internes locataire

  T_DASH --> T_PROFILE

  T_DASH --> T_SEARCH

  T_DASH --> T_RENT

  T_DASH --> T_INCIDENT

  T_DASH --> T_DOCS



  T_SEARCH --> LIST

  T_SEARCH --> T_APPLY

  T_APPLY --> O_APPLIC

  T_APPLY --> CORE_AI

  T_LEASE --> CORE_ESIGN

  T_RENT --> CORE_PAY

  T_RENT --> T_RECEIPT

  T_EDL --> CORE_DOC

  T_INCIDENT --> O_TICKETS

  T_CHAT --> CORE_CHAT

  T_ENERGY --> CORE_API

  T_INSURANCE --> CORE_API



  %% Garant

  G_DASH --> G_PROFILE

  G_DASH --> G_LINK

  G_LINK --> T_LEASE

  G_DOCS --> CORE_STORAGE

  G_CONSENT --> CORE_ESIGN

  G_FOLLOW --> CORE_NOTIF



  %% Prestataire

  V_DASH --> V_PROFILE

  V_DASH --> V_SERVICES

  V_DASH --> V_ZONE

  V_JOBS --> V_PLANNING

  V_QUOTES --> O_VENDOR

  V_INVOICES --> CORE_PAY

  V_CHAT --> CORE_CHAT



  %% Admin & Core

  A_DASH --> A_USERS

  A_DASH --> A_PROPS

  A_DASH --> A_ANALYTICS

  A_API --> CORE_API

  A_BILLING --> CORE_PAY

  A_CONTENT --> BLOG

  A_CONTENT --> HELP

  A_SUPPORT --> CORE_NOTIF

  CORE_NOTIF --> O_NOTIF

  CORE_NOTIF --> T_DASH

  CORE_NOTIF --> G_DASH

  CORE_NOTIF --> V_DASH
```

