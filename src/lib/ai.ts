'use client';

import type { FirebaseApp } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { getAppFunctions } from '@/firebase';
import { blobToDataUri, compressImage } from './attachments';

export interface ScanResult {
  kind: 'invoice' | 'receipt' | 'check' | 'transfer' | 'other';
  direction: 'expense' | 'income' | 'unknown';
  checkType: 'toCollect' | 'issued' | 'unknown';
  amount: number;
  currency: string;
  date: string;
  dueDate: string;
  counterparty: string;
  description: string;
  category: string;
  checkNumber: string;
  bank: string;
  confidence: number;
  notes: string;
  remaining?: number;
}

/** Lee una foto de factura, ticket o cheque con IA (Cloud Function leerComprobante). */
export async function scanDocument(app: FirebaseApp, file: File, opts: { categories: string[]; walletName: string }): Promise<ScanResult> {
  const small = await compressImage(file, 1600, 0.85);
  const dataUri = await blobToDataUri(small);
  const [, mimeType = 'image/jpeg', imageBase64 = ''] = dataUri.match(/^data:([^;]+);base64,(.*)$/) ?? [];
  const fn = httpsCallable<unknown, ScanResult>(getAppFunctions(app), 'leerComprobante', { timeout: 70000 });
  const res = await fn({ imageBase64, mimeType, categories: opts.categories, walletName: opts.walletName });
  return res.data;
}

export async function suggestCategoryAI(app: FirebaseApp, description: string, categories: string[]): Promise<string> {
  const fn = httpsCallable<unknown, { category: string }>(getAppFunctions(app), 'sugerirCategoria', { timeout: 30000 });
  return (await fn({ description, categories })).data.category;
}

/** Mensaje entendible para los errores de la IA. */
export function aiErrorMessage(e: any): string {
  const code: string = e?.code ?? '';
  if (code.includes('failed-precondition')) return 'La lectura con IA todavía no está activada (falta configurar la clave de Gemini).';
  if (code.includes('resource-exhausted')) return e?.message || 'Llegaste al límite de lecturas con IA por hoy.';
  if (code.includes('unauthenticated')) return 'Volvé a iniciar sesión.';
  if (code.includes('not-found')) return 'La función de IA no está publicada todavía.';
  if (code.includes('invalid-argument')) return e?.message || 'La foto no es válida.';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Sin conexión: la lectura con IA necesita internet.';
  return 'No se pudo leer el comprobante. Probá con una foto más nítida y con buena luz.';
}
