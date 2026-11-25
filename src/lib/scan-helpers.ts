import type { ScanMode, ScanResult } from './ai';
import { formatMoney } from './format';
import type { Attachment, CheckType } from '@/types';

export interface CheckPrefillData {
  type?: CheckType;
  amount?: number;
  party?: string;
  dueDate?: string;
  bank?: string;
  checkNumber?: string;
  notes?: string;
  attachments?: Attachment[];
  aiNote?: string;
}

const KIND_LABEL: Record<ScanResult['kind'], string> = {
  invoice: 'una factura',
  receipt: 'un ticket',
  check: 'un cheque',
  transfer: 'una transferencia',
  other: 'otro tipo de comprobante',
};

/** Texto de revisión: qué se leyó y si la foto parece no coincidir con lo elegido. */
export function scanNote(r: ScanResult, mode: ScanMode) {
  const parts: string[] = [];
  const wantsCheck = mode === 'toCollect' || mode === 'issued';
  if (r.kind !== 'other' && (r.kind === 'check') !== wantsCheck) parts.push(`Ojo: la foto parece ${KIND_LABEL[r.kind]}`);
  if (r.currency && r.currency !== 'ARS' && r.amount) parts.push(`El importe está en ${r.currency}: ${formatMoney(r.amount, r.currency)}`);
  if (r.confidence && r.confidence < 0.6) parts.push('La foto no se leyó del todo bien');
  if (r.notes) parts.push(r.notes);
  parts.push('Revisá los datos antes de guardar');
  return `${parts.join('. ')}.`;
}

export function checkPrefillFrom(r: ScanResult, mode: 'toCollect' | 'issued', attachment: Attachment | null): CheckPrefillData {
  return {
    type: mode,
    amount: r.amount || undefined,
    party: r.counterparty || undefined,
    dueDate: r.dueDate || r.date || undefined,
    bank: r.bank || undefined,
    checkNumber: r.checkNumber || undefined,
    attachments: attachment ? [attachment] : [],
    aiNote: scanNote(r, mode),
  };
}

