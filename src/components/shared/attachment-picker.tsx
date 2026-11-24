'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, FileText, ImagePlus, Loader2, X, Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { deleteAttachments, MAX_ATTACHMENTS, uploadAttachment } from '@/lib/attachments';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Borrador de adjuntos de un formulario: sube al elegir, y al guardar/cancelar
 * borra de Storage lo que corresponda para no dejar archivos huérfanos.
 */
export function useAttachmentDraft() {
  const [items, setItems] = useState<Attachment[]>([]);
  const original = useRef<Attachment[]>([]);
  const added = useRef<Set<string>>(new Set());

  const reset = useCallback((initial: Attachment[] = []) => {
    original.current = initial;
    added.current = new Set();
    setItems(initial);
  }, []);

  const add = useCallback((a: Attachment) => {
    added.current.add(a.path);
    setItems((prev) => [...prev, a]);
  }, []);

  const remove = useCallback((path: string) => setItems((prev) => prev.filter((a) => a.path !== path)), []);

  /** Llamar después de guardar: borra los archivos que se quitaron. */
  const commit = useCallback(() => {
    const keep = new Set(items.map((a) => a.path));
    const removed = original.current.filter((a) => !keep.has(a.path));
    const removedNew = Array.from(added.current).filter((p) => !keep.has(p));
    deleteAttachments([...removed, ...removedNew.map((path) => ({ path }) as Attachment)]);
    original.current = items;
    added.current = new Set();
  }, [items]);

  /** Llamar al cancelar: borra lo que se subió en esta edición. */
  const discard = useCallback(() => {
    const fresh = Array.from(added.current);
    if (fresh.length) deleteAttachments(fresh.map((path) => ({ path }) as Attachment));
    added.current = new Set();
  }, []);

  return { items, add, remove, reset, commit, discard };
}

export function AttachmentPicker({
  walletId,
  draft,
  label = 'Foto de la factura o boleta',
  disabled,
}: {
  walletId: string;
  draft: ReturnType<typeof useAttachmentDraft>;
  label?: string;
  disabled?: boolean;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const full = draft.items.length >= MAX_ATTACHMENTS;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    if (!navigator.onLine) {
      toast({ title: 'Sin conexión', description: 'Para subir fotos necesitás internet. Podés agregarlas después editando el registro.' });
      return;
    }
    const list = Array.from(files).slice(0, MAX_ATTACHMENTS - draft.items.length);
    setUploading((n) => n + list.length);
    await Promise.all(
      list.map(async (f) => {
        try {
          draft.add(await uploadAttachment(walletId, user.uid, f));
        } catch (e: any) {
          toast({
            variant: 'destructive',
            title: 'No se pudo subir el archivo',
            description: e?.message === 'tipo' ? 'Sólo fotos o PDF.' : e?.message === 'tamaño' ? 'El archivo es demasiado grande (máx. 8 MB).' : 'Probá de nuevo.',
          });
        } finally {
          setUploading((n) => n - 1);
        }
      })
    );
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">
        {label} <span className="font-normal text-muted-foreground">(opcional)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {draft.items.map((a) => (
          <div key={a.path} className="group relative h-20 w-20 overflow-hidden rounded-xl border bg-muted">
            <button type="button" className="h-full w-full" onClick={() => setPreview(a)} aria-label={`Ver ${a.name}`}>
              {a.contentType === 'application/pdf' ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-6 w-6" /> PDF
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
              )}
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={() => draft.remove(a.path)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Quitar adjunto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="flex h-20 w-20 items-center justify-center rounded-xl border bg-muted">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ))}
        {!disabled && !full && (
          <>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Camera className="h-5 w-5" /> Cámara
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <ImagePlus className="h-5 w-5" /> Galería
            </button>
          </>
        )}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <input ref={galleryRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <AttachmentViewer attachment={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

export function AttachmentViewer({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  return (
    <Dialog open={!!attachment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate text-base">{attachment?.name}</DialogTitle>
        </DialogHeader>
        {attachment &&
          (attachment.contentType === 'application/pdf' ? (
            <a href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border p-8 font-semibold text-primary hover:bg-muted">
              <FileText className="h-6 w-6" /> Abrir PDF
            </a>
          ) : (
            <a href={attachment.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.url} alt={attachment.name} className="max-h-[70dvh] w-full rounded-xl object-contain" />
            </a>
          ))}
      </DialogContent>
    </Dialog>
  );
}

/** Indicador chico de "tiene adjuntos" para las listas. */
export function AttachmentBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-muted-foreground', className)} title={`${count} adjunto(s)`}>
      <Paperclip className="h-3 w-3" />
      {count > 1 && <span className="text-[10px]">{count}</span>}
    </span>
  );
}
