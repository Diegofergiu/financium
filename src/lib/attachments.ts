'use client';

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '@/firebase';
import type { Attachment } from '@/types';

export const MAX_ATTACHMENTS = 4;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Reduce una foto (máx. 1600 px, JPEG) para que suba rápido y ocupe poco. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Sube un archivo a wallets/{walletId}/attachments/{uid}/… y devuelve su descripción. */
export async function uploadAttachment(walletId: string, uid: string, file: File): Promise<Attachment> {
  const isPdf = file.type === 'application/pdf';
  if (!isPdf && !file.type.startsWith('image/')) throw new Error('tipo');
  const blob = isPdf ? file : await compressImage(file);
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('tamaño');
  const contentType = isPdf ? 'application/pdf' : blob.type || 'image/jpeg';
  const ext = isPdf ? 'pdf' : contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `wallets/${walletId}/attachments/${uid}/${id}.${ext}`;
  const r = ref(getFirebaseStorage(), path);
  await uploadBytes(r, blob, { contentType, customMetadata: { originalName: file.name.slice(0, 120) } });
  const url = await getDownloadURL(r);
  return { path, url, name: file.name.slice(0, 120) || `foto.${ext}`, contentType, size: blob.size };
}

export async function deleteAttachments(items: Attachment[]) {
  const storage = getFirebaseStorage();
  await Promise.all(items.map((a) => deleteObject(ref(storage, a.path)).catch(() => {})));
}
