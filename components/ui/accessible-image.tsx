"use client";

import * as React from "react";
import Image, { ImageProps } from "next/image";
import { cn } from "@/lib/utils";

interface AccessibleImageProps extends Omit<ImageProps, "alt"> {
  /**
   * Texte alternatif obligatoire pour l'accessibilité.
   * Doit décrire le contenu de l'image de manière concise.
   * Pour les images décoratives, utiliser alt="" explicitement.
   */
  alt: string;
  /**
   * Indication si l'image est purement décorative
   * Si true, l'image sera cachée des lecteurs d'écran
   */
  decorative?: boolean;
  /**
   * Description longue pour les images complexes (graphiques, diagrammes)
   */
  longdesc?: string;
  /**
   * Composant à afficher pendant le chargement
   */
  fallback?: React.ReactNode;
  /**
   * Classe CSS pour le conteneur
   */
  containerClassName?: string;
}

/**
 * AccessibleImage - Composant Image Next.js avec accessibilité améliorée
 *
 * Features:
 * - Alt obligatoire avec validation
 * - Support des images décoratives (aria-hidden)
 * - Description longue pour images complexes
 * - Fallback pendant le chargement
 * - Gestion des erreurs de chargement
 *
 * Usage:
 * ```tsx
 * // Image normale
 * <AccessibleImage
 *   src="/photo.jpg"
 *   alt="Photo de l'appartement, salon lumineux avec vue sur jardin"
 *   width={400}
 *   height={300}
 * />
 *
 * // Image décorative
 * <AccessibleImage
 *   src="/decoration.svg"
 *   alt=""
 *   decorative
 *   width={100}
 *   height={100}
 * />
 * ```
 */
export function AccessibleImage({
  alt,
  decorative = false,
  longdesc,
  fallback,
  containerClassName,
  className,
  onError,
  ...props
}: AccessibleImageProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const descriptionId = React.useId();

  // Validation: alt ne doit pas être undefined
  if (alt === undefined) {
    console.warn(
      "AccessibleImage: alt prop is required. Use alt=\"\" for decorative images."
    );
  }

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    setIsLoading(false);
    onError?.(e);
  };

  // Image décorative
  if (decorative) {
    return (
      <Image
        alt=""
        aria-hidden="true"
        role="presentation"
        className={className}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    );
  }

  return (
    <figure className={cn("relative", containerClassName)}>
      {/* Fallback pendant le chargement */}
      {isLoading && fallback && (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallback}
        </div>
      )}

      {/* Placeholder en cas d'erreur */}
      {hasError ? (
        <div
          className={cn(
            "flex items-center justify-center bg-muted text-muted-foreground",
            className
          )}
          role="img"
          aria-label={alt}
          style={{ width: props.width, height: props.height }}
        >
          <span className="text-sm">Image non disponible</span>
        </div>
      ) : (
        <Image
          alt={alt}
          className={cn(isLoading && "opacity-0", className)}
          onLoad={handleLoad}
          onError={handleError}
          aria-describedby={longdesc ? descriptionId : undefined}
          {...props}
        />
      )}

      {/* Description longue pour les images complexes */}
      {longdesc && (
        <figcaption id={descriptionId} className="sr-only">
          {longdesc}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * PropertyImage - Image optimisée pour les biens immobiliers
 */
interface PropertyImageProps extends Omit<AccessibleImageProps, "alt"> {
  /**
   * Adresse du bien pour générer automatiquement le alt
   */
  propertyAddress: string;
  /**
   * Type de photo (principal, chambre, salon, etc.)
   */
  photoType?: string;
}

export function PropertyImage({
  propertyAddress,
  photoType = "principal",
  ...props
}: PropertyImageProps) {
  const alt = `Photo ${photoType} du bien situé ${propertyAddress}`;

  return <AccessibleImage alt={alt} {...props} />;
}

/**
 * AvatarImage - Image optimisée pour les avatars
 */
interface AvatarImageProps extends Omit<AccessibleImageProps, "alt"> {
  /**
   * Nom de la personne pour le alt
   */
  name: string;
}

export function AvatarImage({ name, ...props }: AvatarImageProps) {
  const alt = `Photo de profil de ${name}`;

  return <AccessibleImage alt={alt} {...props} />;
}

/**
 * DocumentThumbnail - Miniature de document
 */
interface DocumentThumbnailProps extends Omit<AccessibleImageProps, "alt"> {
  /**
   * Titre du document
   */
  documentTitle: string;
  /**
   * Type de document
   */
  documentType?: string;
}

export function DocumentThumbnail({
  documentTitle,
  documentType = "document",
  ...props
}: DocumentThumbnailProps) {
  const alt = `Aperçu du ${documentType} : ${documentTitle}`;

  return <AccessibleImage alt={alt} {...props} />;
}
