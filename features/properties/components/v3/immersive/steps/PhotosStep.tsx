"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2, Trash2, Star } from "lucide-react";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { propertiesService } from "@/features/properties/services/properties.service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from "next/image";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export function PhotosStep() {
  const { propertyId, photos, rooms, setPhotos } = usePropertyWizardStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !propertyId) return;
    setUploading(true);
    const tempPhotos = Array.from(files).map(file => ({
      id: `temp-${Math.random()}`, url: URL.createObjectURL(file), is_main: false, property_id: propertyId,
      room_id: null, tag: "vue_generale" as const, ordre: photos.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }));
    setPhotos([...photos, ...tempPhotos] as any);
    try {
      for (const file of Array.from(files)) {
        const { upload_url } = await propertiesService.requestPhotoUploadUrl(propertyId, { file_name: file.name, mime_type: file.type, tag: "vue_generale" });
        await fetch(upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      }
      setPhotos(await propertiesService.listPhotos(propertyId));
      toast({ title: "Photos ajoutées" });
    } catch { toast({ title: "Erreur upload", variant: "destructive" }); setPhotos(await propertiesService.listPhotos(propertyId)); }
    finally { setUploading(false); }
  };

  const handleDelete = async (photoId: string) => {
    if (!propertyId) return;
    setPhotos(photos.filter(p => p.id !== photoId));
    try { await propertiesService.deletePhoto(photoId); } catch { setPhotos(await propertiesService.listPhotos(propertyId)); }
  };

  const handleSetMain = async (photoId: string) => {
    if (!propertyId || photos.find(p => p.id === photoId)?.is_main) return;
    setPhotos(photos.map(p => ({ ...p, is_main: p.id === photoId })));
    try { await propertiesService.updatePhoto(photoId, { is_main: true }); } catch { setPhotos(await propertiesService.listPhotos(propertyId)); }
  };

  const handleAssignRoom = async (photoId: string, roomId: string) => {
    if (!propertyId) return;
    const effectiveRoomId = roomId === "none" ? null : roomId;
    setPhotos(photos.map(p => p.id === photoId ? { ...p, room_id: effectiveRoomId } : p));
    try { await propertiesService.updatePhoto(photoId, { room_id: effectiveRoomId }); } catch { setPhotos(await propertiesService.listPhotos(propertyId)); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Zone Drop */}
      <div
        className={cn(
          "flex-shrink-0 border-2 border-dashed rounded-xl p-4 mb-4 transition-all flex items-center gap-4 cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
        <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
          {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
        </div>
        <div>
          <p className="font-medium">Glissez vos photos ou cliquez</p>
          <p className="text-sm text-muted-foreground">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Grille Photos - Flexible */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            <AnimatePresence>
              {photos.map((photo) => (
                <motion.div
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative rounded-lg overflow-hidden border bg-card group aspect-square"
                >
                  <Image src={photo.url || ""} alt="Photo" fill className={cn("object-cover", photo.is_main && "ring-2 ring-primary ring-inset")} />
                  
                  {photo.is_main && (
                    <span className="absolute top-1 left-1 bg-primary text-white text-[9px] px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-current" />
                    </span>
                  )}

                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    {!photo.is_main && (
                      <button onClick={(e) => { e.stopPropagation(); handleSetMain(photo.id); }} className="bg-white/90 text-foreground text-[10px] px-2 py-1 rounded font-medium hover:bg-white flex items-center gap-1">
                        <Star className="h-3 w-3" /> Principale
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }} className="bg-destructive text-white text-[10px] px-2 py-1 rounded font-medium hover:bg-destructive/90 flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Liaison pièces */}
      {photos.length > 0 && rooms.length > 0 && (
        <div className="flex-shrink-0 border-t pt-3 mt-3">
          <p className="text-xs text-muted-foreground mb-2">Associer aux pièces</p>
          <div className="flex flex-wrap gap-2">
            {photos.slice(0, 5).map((photo) => (
              <div key={photo.id} className="flex items-center gap-1.5 bg-muted/50 rounded-md p-1.5">
                <div className="h-8 w-8 rounded overflow-hidden relative flex-shrink-0">
                  <Image src={photo.url || ""} alt="" fill className="object-cover" />
                </div>
                <Select value={photo.room_id || "none"} onValueChange={(val) => handleAssignRoom(photo.id, val)}>
                  <SelectTrigger className="h-7 text-[10px] w-20 border-0 bg-transparent"><SelectValue placeholder="Pièce" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Général</SelectItem>
                    {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.label_affiche}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {photos.length > 5 && <span className="text-xs text-muted-foreground self-center">+{photos.length - 5}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
