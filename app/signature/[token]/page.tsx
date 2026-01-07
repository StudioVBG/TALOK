export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { SignatureFlow } from "./SignatureFlow";

interface PageProps {
  params: Promise<{ token: string }>;
}

interface TokenData {
  leaseId: string;
  tenantEmail: string;
  timestamp: number;
}

function decodeToken(token: string): TokenData | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [leaseId, tenantEmail, timestampStr] = decoded.split(":");
    
    if (!leaseId || !tenantEmail || !timestampStr) {
      return null;
    }
    
    return {
      leaseId,
      tenantEmail,
      timestamp: parseInt(timestampStr, 10),
    };
  } catch (error) {
    console.error("Erreur décodage token:", error);
    return null;
  }
}

function isTokenExpired(timestamp: number): boolean {
  const now = Date.now();
  const sevenDaysMs = 30 * 24 * 60 * 60 * 1000;
  return now - timestamp > sevenDaysMs;
}

async function getLeaseByToken(token: string) {
  // Décoder le token
  const tokenData = decodeToken(token);
  
  if (!tokenData) {
    console.log("[Signature] Token invalide - décodage échoué");
    return null;
  }
  
  // Vérifier l'expiration (7 jours)
  if (isTokenExpired(tokenData.timestamp)) {
    console.log("[Signature] Token expiré");
    return { expired: true, tenantEmail: tokenData.tenantEmail };
  }
  
  // Utiliser le service client pour bypass RLS
  const serviceClient = getServiceClient();
  
  // Récupérer le bail avec la propriété et le propriétaire
  const { data: lease, error: leaseError } = await serviceClient
    .from("leases")
    .select(`
      *,
      property:properties(
        id,
        adresse_complete,
        code_postal,
        ville,
        type,
        surface,
        nb_pieces,
        dpe_classe_energie,
        dpe_classe_climat,
        owner:profiles!properties_owner_id_fkey(
          id,
          prenom,
          nom
        )
      )
    `)
    .eq("id", tokenData.leaseId)
    .single();

  if (leaseError || !lease) {
    console.error("[Signature] Erreur récupération bail:", leaseError);
    return null;
  }

  // Vérifier que le bail est en attente de signature
  if (lease.statut !== "pending_signature" && lease.statut !== "draft") {
    console.log("[Signature] Bail non disponible pour signature, statut:", lease.statut);
    return { alreadySigned: true };
  }

  const property = lease.property as any;
  const owner = property?.owner;
  
  return {
    lease,
    tenantEmail: tokenData.tenantEmail,
    ownerName: owner ? `${owner.prenom} ${owner.nom}` : "Propriétaire",
    propertyAddress: property 
      ? `${property.adresse_complete}, ${property.code_postal} ${property.ville}`
      : "Adresse non disponible",
    expired: false,
  };
}

export default async function SignaturePage({ params }: PageProps) {
  const { token } = await params;

  const result = await getLeaseByToken(token);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="text-center p-8 max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Lien invalide
          </h1>
          <p className="text-muted-foreground">
            Ce lien d'invitation n'existe pas ou a déjà été utilisé.
            Veuillez contacter votre propriétaire pour obtenir un nouveau lien.
          </p>
        </div>
      </div>
    );
  }

  if (result.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="text-center p-8 max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Lien expiré
          </h1>
          <p className="text-muted-foreground">
            Ce lien d'invitation a expiré (validité 7 jours).
            Veuillez contacter votre propriétaire pour recevoir une nouvelle invitation.
          </p>
        </div>
      </div>
    );
  }

  if ("alreadySigned" in result && result.alreadySigned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="text-center p-8 max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Bail déjà signé
          </h1>
          <p className="text-muted-foreground">
            Ce bail a déjà été signé ou n'est plus en attente de signature.
            Vous pouvez consulter vos documents dans votre espace locataire.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SignatureFlow
      token={token}
      lease={result.lease}
      tenantEmail={result.tenantEmail || ""}
      ownerName={result.ownerName}
      propertyAddress={result.propertyAddress}
    />
  );
}

export const metadata = {
  title: "Signer votre bail | Talok",
  description: "Complétez votre profil et signez votre contrat de location",
};

