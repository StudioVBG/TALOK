"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Image as ImageIcon,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  onUpload: (file: File) => Promise<string>;
  label?: string;
  description?: string;
  disabled?: boolean;
  accept?: string;
  maxSize?: number; // en bytes
  aspectRatio?: "square" | "wide" | "auto";
  previewSize?: "sm" | "md" | "lg";
  className?: string;
}

export function LogoUpload({
  value,
  onChange,
  onUpload,
  label,
  description,
  disabled = false,
  accept = "image/png,image/jpeg,image/svg+xml,image/webp",
  maxSize = 2 * 1024 * 1024, // 2MB
  aspectRatio = "auto",
  previewSize = "md",
  className,
}: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-20 w-20",
    md: "h-32 w-32",
    lg: "h-40 w-40",
  };

  const aspectClasses = {
    square: "aspect-square",
    wide: "aspect-video",
    auto: "",
  };

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploadSuccess(false);

      // Valider le type
      if (!accept.split(",").some((type) => file.type === type.trim())) {
        setError("Type de fichier non supporté");
        return;
      }

      // Valider la taille
      if (file.size > maxSize) {
        setError(`Fichier trop volumineux (max ${Math.round(maxSize / 1024 / 1024)}MB)`);
        return;
      }

      setIsUploading(true);

      try {
        const url = await onUpload(file);
        onChange(url);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur d'upload");
      } finally {
        setIsUploading(false);
      }
    },
    [accept, maxSize, onChange, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleRemove = useCallback(() => {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onChange]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all",
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-200 hover:border-slate-300",
          disabled && "opacity-50 cursor-not-allowed",
          !value && "p-6"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled || isUploading}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {value ? (
            // Prévisualisation
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative group p-4"
            >
              <div
                className={cn(
                  "mx-auto overflow-hidden rounded-lg bg-slate-100",
                  sizeClasses[previewSize],
                  aspectClasses[aspectRatio]
                )}
              >
                <img
                  src={value}
                  alt="Logo preview"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Overlay actions */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-xl">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled || isUploading}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Changer
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleRemove}
                  disabled={disabled || isUploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Badge succès */}
              <AnimatePresence>
                {uploadSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute -top-2 -right-2"
                  >
                    <div className="bg-green-500 text-white rounded-full p-1">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            // Zone d'upload
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center text-center"
            >
              {isUploading ? (
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
              )}

              <p className="text-sm font-medium text-slate-700 mb-1">
                {isUploading ? "Upload en cours..." : "Glissez votre logo ici"}
              </p>
              <p className="text-xs text-slate-500 mb-3">
                PNG, JPG, SVG ou WebP (max {Math.round(maxSize / 1024 / 1024)}MB)
              </p>

              <Button
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Parcourir
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Message d'erreur */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-sm text-red-600"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {description && !error && (
        <p className="text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}

export default LogoUpload;
