"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileSignature, Shield, Scale, Users } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";
import type { CautionType } from "@/lib/types/guarantor";
import { CAUTION_TYPE_LABELS } from "@/lib/types/guarantor";

interface CautionActeViewerProps {
  cautionType: CautionType;
  guarantorName: string;
  tenantName: string;
  propertyAddress: string;
  propertyVille: string;
  loyer: number;
  charges: number;
  montantGaranti: number | null;
  dureeEngagement: string | null;
  visaleNumber?: string | null;
  signedAt?: string | null;
}

/**
 * CautionActeViewer - Affiche l'acte de cautionnement (simple, solidaire ou Visale)
 * Document légal conforme au droit français (loi ELAN, art. 22-1 loi 89-462)
 */
export function CautionActeViewer({
  cautionType,
  guarantorName,
  tenantName,
  propertyAddress,
  propertyVille,
  loyer,
  charges,
  montantGaranti,
  dureeEngagement,
  visaleNumber,
  signedAt,
}: CautionActeViewerProps) {
  const totalMensuel = loyer + charges;

  const typeIcons: Record<CautionType, typeof Shield> = {
    simple: Scale,
    solidaire: Users,
    visale: Shield,
  };

  const TypeIcon = typeIcons[cautionType];

  return (
    <Card className="border-2">
      <CardHeader className="bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <TypeIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Acte de Cautionnement</CardTitle>
              <Badge variant="outline" className="mt-1">
                {CAUTION_TYPE_LABELS[cautionType]}
              </Badge>
            </div>
          </div>
          {signedAt && (
            <div className="flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">
                Signé le {new Date(signedAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6 text-sm leading-relaxed">
        {/* En-tête légal */}
        <div className="text-center space-y-1">
          <p className="font-semibold text-base">
            ACTE DE CAUTIONNEMENT {cautionType === "solidaire" ? "SOLIDAIRE" : cautionType === "simple" ? "SIMPLE" : "VISALE"}
          </p>
          <p className="text-muted-foreground">
            (Articles 2288 et suivants du Code civil — Loi n°89-462 du 6 juillet 1989, art. 22-1)
          </p>
        </div>

        <Separator />

        {/* Parties */}
        <div className="space-y-3">
          <p className="font-medium">Entre les soussignés :</p>
          <div className="pl-4 space-y-2">
            <p>
              <strong>Le garant :</strong> {guarantorName}
              {visaleNumber && (
                <span className="text-muted-foreground"> (Visale n° {visaleNumber})</span>
              )}
            </p>
            <p>
              <strong>Le locataire cautionné :</strong> {tenantName}
            </p>
          </div>
        </div>

        <Separator />

        {/* Objet */}
        <div className="space-y-3">
          <p className="font-medium">Objet du cautionnement :</p>
          <div className="pl-4 space-y-2">
            <p>
              <strong>Bien loué :</strong> {propertyAddress}, {propertyVille}
            </p>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground text-xs">Loyer mensuel</p>
                <p className="font-semibold">{formatCurrency(loyer)}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground text-xs">Charges</p>
                <p className="font-semibold">{formatCurrency(charges)}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground text-xs">Total mensuel</p>
                <p className="font-semibold">{formatCurrency(totalMensuel)}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Montant garanti */}
        <div className="space-y-2">
          <p className="font-medium">Montant maximum garanti :</p>
          <p className="pl-4">
            {montantGaranti
              ? `${formatCurrency(montantGaranti)} (montant plafonné)`
              : "Le cautionnement couvre l'intégralité des sommes dues par le locataire au bailleur (loyer, charges, indemnités d'occupation, réparations locatives et frais de remise en état)."}
          </p>
        </div>

        {/* Durée */}
        <div className="space-y-2">
          <p className="font-medium">Durée de l'engagement :</p>
          <p className="pl-4">
            {dureeEngagement === "duree_bail"
              ? "Le présent cautionnement est consenti pour la durée du bail et de ses renouvellements éventuels."
              : dureeEngagement === "illimitee"
              ? "Le présent cautionnement est consenti pour une durée indéterminée. La caution pourra être dénoncée par lettre recommandée avec AR."
              : "Le présent cautionnement est consenti pour la durée du bail en cours."}
          </p>
        </div>

        <Separator />

        {/* Clauses spécifiques selon le type */}
        {cautionType === "solidaire" && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
            <p className="font-medium text-amber-900">
              Clause de solidarité (renonciation au bénéfice de discussion et de division) :
            </p>
            <p className="text-amber-800">
              La caution renonce expressément au bénéfice de discussion prévu à l'article 2298 du Code civil
              et au bénéfice de division prévu à l'article 2303 du Code civil. En conséquence, le bailleur
              pourra poursuivre directement la caution en paiement sans être tenu de poursuivre préalablement
              le locataire.
            </p>
          </div>
        )}

        {cautionType === "simple" && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <p className="font-medium text-blue-900">
              Caution simple (bénéfice de discussion) :
            </p>
            <p className="text-blue-800">
              Conformément à l'article 2298 du Code civil, la caution ne sera tenue de payer qu'après
              que le bailleur aura poursuivi le locataire dans ses biens sans obtenir satisfaction.
            </p>
          </div>
        )}

        {cautionType === "visale" && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <p className="font-medium text-blue-900">
              Garantie Visale — Action Logement :
            </p>
            <p className="text-blue-800">
              Ce cautionnement est garanti par Action Logement dans le cadre du dispositif Visale.
              La garantie couvre les impayés de loyer et charges locatives pendant toute la durée du bail,
              dans la limite de 36 mensualités.
              {visaleNumber && (
                <span className="block mt-1 font-medium">
                  Numéro de visa : {visaleNumber}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Mentions obligatoires (art. 22-1 loi 89-462) */}
        <div className="p-4 bg-muted rounded-lg space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground text-sm">Mentions obligatoires :</p>
          <p>
            Conformément à l'article 22-1 de la loi n°89-462 du 6 juillet 1989, la caution déclare
            avoir pris connaissance que lorsque le cautionnement d'obligations résultant d'un contrat de
            location est à durée indéterminée, la caution peut le résilier unilatéralement. La résiliation
            prend effet au terme du contrat de location, qu'il s'agisse du contrat initial ou d'un contrat
            reconduit ou renouvelé, au cours duquel le bailleur reçoit notification de la résiliation.
          </p>
          <p>
            Le montant du loyer et les conditions de sa révision sont notifiés à la caution au moment
            de la conclusion du contrat de cautionnement. Le bailleur est tenu d'informer la caution de
            tout impayé du locataire dans le mois suivant le terme.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
