"use client";

import Image, { ImageProps } from "next/image";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends Omit<ImageProps, "onError" | "onLoad"> {
  fallbackSrc?: string;
  showSkeleton?: boolean;
  aspectRatio?: "square" | "video" | "portrait" | "auto";
  containerClassName?: string;
  sizes?: string;
}

/**
 * Composant Image optimisé avec:
 * - Fallback automatique en cas d'erreur
 * - Skeleton pendant le chargement
 * - Support des ratios d'aspect
 * - Lazy loading par défaut
 */
export function OptimizedImage({
  src,
  alt,
  fallbackSrc = "/images/placeholder.svg",
  showSkeleton = true,
  aspectRatio = "auto",
  className,
  containerClassName,
  fill,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  // Classes pour les ratios d'aspect
  const aspectRatioClasses = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
    auto: "",
  };

  // Source finale (fallback si erreur)
  const finalSrc = hasError ? fallbackSrc : src;

  // Si fill est utilisé, on a besoin d'un conteneur relatif
  if (fill) {
    return (
      <div
        className={cn(
          "relative overflow-hidden",
          aspectRatioClasses[aspectRatio],
          containerClassName
        )}
      >
        {showSkeleton && isLoading && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        <Image
          src={finalSrc}
          alt={alt}
          fill
          sizes={sizes}
          className={cn(
            "object-cover transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100",
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      </div>
    );
  }

  // Mode avec dimensions fixes
  return (
    <div className={cn("relative overflow-hidden inline-block", containerClassName)}>
      {showSkeleton && isLoading && (
        <div
          className="absolute inset-0 bg-muted animate-pulse rounded"
          style={{ width, height }}
        />
      )}
      <Image
        src={finalSrc}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
}

/**
 * Avatar optimisé avec Next/Image
 */
interface OptimizedAvatarProps {
  src?: string | null;
  alt: string;
  fallbackText?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function OptimizedAvatar({
  src,
  alt,
  fallbackText,
  size = "md",
  className,
}: OptimizedAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: "h-6 w-6 text-xs",
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-base",
    lg: "h-12 w-12 text-lg",
    xl: "h-16 w-16 text-xl",
  };

  const sizePx = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  // Si pas d'image ou erreur, afficher le fallback text
  if (!src || hasError) {
    const initials = fallbackText
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

    return (
      <div
        className={cn(
          "rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium",
          sizeClasses[size],
          className
        )}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-full overflow-hidden", sizeClasses[size], className)}>
      <Image
        src={src}
        alt={alt}
        width={sizePx[size]}
        height={sizePx[size]}
        className="object-cover w-full h-full"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

/**
 * Image de propriété optimisée
 */
interface PropertyImageProps {
  src?: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
}

export function PropertyImage({
  src,
  alt,
  priority = false,
  className,
}: PropertyImageProps) {
  const [hasError, setHasError] = useState(false);

  const placeholderUrl = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80";
  const finalSrc = hasError || !src ? placeholderUrl : src;

  return (
    <div className={cn("relative w-full aspect-video overflow-hidden rounded-lg bg-muted", className)}>
      <Image
        src={finalSrc}
        alt={alt}
        fill
        priority={priority}
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default OptimizedImage;

