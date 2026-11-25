'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, ImagePlus, Loader2, ScanLine } from 'lucide-react';
import { useFirebaseApp, useUser } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { useTransactionDialog } from '@/components/transactions/transaction-dialog';
import { CheckDialog, type CheckPrefill } from '@/components/checks/check-dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { uploadAttachment } from '@/lib/attachments';
import { aiErrorMessage, scanDocument, type ScanResult } from '@/lib/ai';
import { formatMoney, todayISO } from '@/lib/format';
import type { Attachment } from '@/types';

const Ctx = createContext<{ scan: () => void; busy: boolean }>({ scan: () => {}, busy: false });
export const useScan = () => useContext(Ctx);

const KIND_LABEL: Record<ScanResult['kind'], string> = {
  invoice: 'una factura',
  receipt: 'un ticket',
  check: 'un cheque',
  transfer: 'una transferencia',
  other: 'un comprobante',
};

function noteFor(r: ScanResult) {
  const parts = [`Detecté ${KIND_LABEL[r.kind]}`];
  if (r.kind === 'check') parts[0] += r.checkType === 'issued' ? ' a pagar' : ' a cobrar';
  else if (r.direction !== 'unknown') parts[0] += r.direction === 'income' ? ' (ingreso)' : ' (gasto)';
  if (r.currency && r.currency !== 'ARS' && r.amount) parts.push(`El importe está en ${r.currency}: ${formatMoney(r.amount, r.currency)}`);
  if (r.confidence && r.confidence < 0.6) parts.push('La foto no se leyó del todo bien');
  if (r.notes) parts.push(r.notes);
  return `${parts.join('. ')}. Revisá los datos antes de guardar.`;
}

/**
 * "Escanear": sacás una foto de una factura, ticket o cheque y la IA abre el formulario
 * correcto (gasto, ingreso o cheque a cobrar/pagar) con los datos completos y la foto adjunta.
 */
export function ScanProvider({ children }: { children: ReactNode }) {
  const app = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWallet, categories, canEdit } = useWallet();
  const { openTransaction } = useTransactionDialog();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [chooser, setChooser] = useState(false);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ open: boolean; prefill: CheckPrefill | null }>({ open: false, prefill: null });

  const openCheckFrom = useCallback((r: ScanResult, attachment: Attachment | null) => {
    setCheck({
      open: true,
      prefill: {
        type: r.checkType === 'issued' ? 'issued' : 'toCollect',
        amount: r.amount || undefined,
        party: r.counterparty || undefined,
        dueDate: r.dueDate || r.date || undefined,
        bank: r.bank || undefined,
        checkNumber: r.checkNumber || undefined,
        attachments: attachment ? [attachment] : [],
        aiNote: noteFor(r),
      },
    });
  }, []);

  // El formulario de movimientos también puede detectar un cheque y pasarlo acá
  useEffect(() => {
    const h = (e: Event) => {
      const { result, attachment } = (e as CustomEvent).detail ?? {};
      if (result) openCheckFrom(result, attachment ?? null);
    };
    window.addEventListener('mibolsillo:scanned-check', h);
    return () => window.removeEventListener('mibolsillo:scanned-check', h);
  }, [openCheckFrom]);

  const process = async (file?: File) => {
    setChooser(false);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
    if (!file || !activeWallet || !user) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Elegí una foto', description: 'Para leer con IA hace falta una imagen (JPG o PNG).' });
      return;
    }
    if (!navigator.onLine) {
      toast({ title: 'Sin conexión', description: 'La lectura con IA necesita internet. Cargá el movimiento a mano y agregá la foto después.' });
      return;
    }
    setBusy(true);
    // Subir la foto y leerla al mismo tiempo
    const [att, res] = await Promise.allSettled([
      uploadAttachment(activeWallet.id, user.uid, file),
      scanDocument(app, file, { categories: categories.map((c) => c.name), walletName: activeWallet.name }),
    ]);
    setBusy(false);
    const attachment = att.status === 'fulfilled' ? att.value : null;
    if (res.status === 'rejected') {
      toast({ variant: 'destructive', title: 'No se pudo leer con IA', description: `${aiErrorMessage(res.reason)}${attachment ? ' Te abro el formulario con la foto adjunta.' : ''}` });
      openTransaction({ prefill: { attachments: attachment ? [attachment] : [] } });
      return;
    }
    const r = res.value;
    if (typeof r.remaining === 'number' && r.remaining <= 5) toast({ title: `Te quedan ${r.remaining} lecturas con IA por hoy` });
    if (r.kind === 'check') {
      openCheckFrom(r, attachment);
      return;
    }
    const cat = categories.find((c) => c.name === r.category);
    openTransaction({
      prefill: {
        type: r.direction === 'income' ? 'income' : 'expense',
        amount: r.amount || undefined,
        description: (r.description || r.counterparty || '').slice(0, 80) || undefined,
        categoryId: cat?.id,
        date: r.date && r.date <= todayISO() ? r.date : undefined,
        notes: r.counterparty && r.description && !r.description.includes(r.counterparty) ? r.counterparty : undefined,
        attachments: attachment ? [attachment] : [],
        aiNote: noteFor(r),
      },
    });
  };

  const scan = useCallback(() => {
    if (!canEdit) return;
    setChooser(true);
  }, [canEdit]);

  return (
    <Ctx.Provider value={{ scan, busy }}>
      {children}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => process(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => process(e.target.files?.[0])} />

      <Sheet open={chooser} onOpenChange={setChooser}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-left font-headline">
              <ScanLine className="h-5 w-5 text-primary" /> Escanear comprobante
            </SheetTitle>
            <SheetDescription className="text-left">
              Factura, ticket, boleta o cheque. La IA detecta si es un gasto, un ingreso o un cheque y completa los datos por vos.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-primary/40 bg-secondary/50 p-5 font-semibold transition-colors hover:bg-secondary">
              <Camera className="h-7 w-7 text-primary" /> Sacar foto
            </button>
            <button onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border p-5 font-semibold transition-colors hover:bg-muted">
              <ImagePlus className="h-7 w-7 text-primary" /> Elegir de la galería
            </button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Consejo: buena luz, el papel entero en la foto y sin sombras.</p>
        </SheetContent>
      </Sheet>

      {busy && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="mx-6 flex flex-col items-center gap-3 rounded-3xl bg-card p-8 text-center shadow-2xl">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="font-headline text-lg font-bold">Leyendo el comprobante…</p>
            <p className="text-sm text-muted-foreground">Esto tarda unos segundos.</p>
          </div>
        </div>
      )}

      <CheckDialog open={check.open} onOpenChange={(open) => setCheck((c) => ({ ...c, open }))} prefill={check.prefill} defaultType={check.prefill?.type} />
    </Ctx.Provider>
  );
}
