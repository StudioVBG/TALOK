"use client";

/**
 * PropertyOwnerInfo - Informations propriétaire
 * Architecture SOTA 2025 - Composant de présentation pur
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Phone, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PropertyOwner, PropertyOwnerInfoProps } from "./types";

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function PropertyOwnerInfo({
  owner,
  className,
  showContacts = false,
  profileHref,
}: PropertyOwnerInfoProps) {
  const initials = `${owner.prenom?.charAt(0) || ""}${owner.nom?.charAt(0) || ""}`.toUpperCase();
  const href = profileHref || `/admin/people/owners/${owner.id}`;

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <User className="h-5 w-5 text-primary" />
          Propriétaire
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar et nom */}
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={owner.avatar_url || undefined} alt={`${owner.prenom} ${owner.nom}`} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">
              {owner.prenom} {owner.nom}
            </p>
            {showContacts && owner.email && (
              <p className="text-sm text-muted-foreground">{owner.email}</p>
            )}
          </div>
        </div>
        
        {/* Contacts - admin only */}
        {showContacts && (
          <div className="space-y-2 pt-2 border-t border-border">
            {owner.email && (
              <a 
                href={`mailto:${owner.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" />
                {owner.email}
              </a>
            )}
            {owner.telephone && (
              <a 
                href={`tel:${owner.telephone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="h-4 w-4" />
                {owner.telephone}
              </a>
            )}
          </div>
        )}
        
        {/* Lien vers profil */}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={href}>
            Voir le profil
            <ExternalLink className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

