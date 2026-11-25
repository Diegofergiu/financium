'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Camera, ImagePlus, Loader2, ScanLine, Ticket } from 'lucide-react';
import { useFirebaseApp, useUser } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { useTransactionDialog } from '@/components/transactions/transaction-dialog';
import { CheckDialog, type CheckPrefill } from '@/components/checks/check-dialog';
import { checkPrefillFrom, scanNote } from '@/lib/scan-helpers';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { uploadAttachment } from '@/lib/attachments';
import { aiErrorMessage, scanDocument, type ScanMode, type ScanResult } from '@/lib/ai';
import { todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';

type ScanScope = 'all' | 'checks';
const Ctx = createContext<{ scan: (scope?: ScanScope) => void; busy: boolean }>({ scan: () => {}, busy: false });
export const useScan = () => useContext(Ctx);

const MODES: { value: ScanMode; label: string; hint: string; icon: typeof Ticket; className: string }[] = [
  { value: 'expense', label: 'Gasto', hint: 'Factura, ticket o boleta que pagaste', icon: ArrowUpRight, className: 'text-expense' },
  { value: 'income', label: 'Ingreso', hint: 'Factura o comprobante de algo que cobraste', icon: ArrowDownLeft, className: 'text-income' },
  { value: 'toCollect', label: 'Cheque a cobrar', hint: 'Un cheque que te dieron', icon: Ticket, className: 'text-income' },
  { value: 'issued', label: 'Cheque a pagar', hint: 'Un cheque que entregaste', icon: Ticket, className: 'text-expense' },
];

/**
 * "Escanear": primero elegís qué es (gasto, ingreso, cheque a cobrar o a pagar), después sacás la foto.
 * La IA sólo lee los datos; nunca cambia lo que elegiste.
 */
export function ScanProvider({ children }: { children: ReactNode }) {
  const app = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWallet, categories, canEdit } = useWallet();
  const { openTransaction } = useTransactionDialog();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<{ open: boolean; scope: ScanScope; mode: ScanMode | null }>({ open: false, scope: 'all', mode: null });
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ open: boolean; prefill: CheckPrefill | null }>({ open: false, prefill: null });

  const process = async (file: File | undefined, mode: ScanMode) => {
    setSheet((s) => ({ ...s, open: false }));
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
    if (!file || !activeWallet || !user) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Elegí una foto', description: 'Para leer con IA hace falta una imagen (JPG o PNG).' });
      return;
    }
    const isCheck = mode === 'toCollect' || mode === 'issued';
    if (!navigator.onLine) {
      toast({ title: 'Sin conexión', description: 'La lectura con IA necesita internet. Cargalo a mano y agregá la foto después.' });
      if (isCheck) setCheck({ open: true, prefill: { type: mode } });
      else openTransaction({ prefill: { type: mode } });
      return;
    }
    setBusy(true);
    const [att, res] = await Promise.allSettled([
      uploadAttachment(activeWallet.id, user.uid, file),
      scanDocument(app, file, { mode, categories: categories.map((c) => c.name), walletName: activeWallet.name }),
    ]);
    setBusy(false);
    const attachment = att.status === 'fulfilled' ? att.value : null;

    if (res.status === 'rejected') {
      toast({ variant: 'destructive', title: 'No se pudo leer con IA', description: `${aiErrorMessage(res.reason)}${attachment ? ' Te abro el formulario con la foto adjunta.' : ''}` });
      if (isCheck) setCheck({ open: true, prefill: { type: mode, attachments: attachment ? [attachment] : [] } });
      else openTransaction({ prefill: { type: mode, attachments: attachment ? [attachment] : [] } });
      return;
    }
    const r = res.value;
    if (typeof r.remaining === 'number' && r.remaining <= 5) toast({ title: `Te quedan ${r.remaining} lecturas con IA por hoy` });

    if (isCheck) {
      setCheck({ open: true, prefill: checkPrefillFrom(r, mode, attachment) });
      return;
    }
    const cat = categories.find((c) => c.name === r.category);
    openTransaction({
      prefill: {
        type: mode,
        amount: r.amount || undefined,
        description: (r.description || r.counterparty || '').slice(0, 80) || undefined,
        categoryId: cat?.id,
        date: r.date && r.date <= todayISO() ? r.date : undefined,
        notes: r.counterparty && r.description && !r.description.includes(r.counterparty) ? r.counterparty : undefined,
        attachments: attachment ? [attachment] : [],
        aiNote: scanNote(r, mode),
      },
    });
  };

  const scan = useCallback(
    (scope: ScanScope = 'all') => {
      if (!canEdit) return;
      setSheet({ open: true, scope, mode: null });
    },
    [canEdit]
  );

  const modes = sheet.scope === 'checks' ? MODES.filter((m) => m.value === 'toCollect' || m.value === 'issued') : MODES;
  const chosen = MODES.find((m) => m.value === sheet.mode);

  return (
    <Ctx.Provider value={{ scan, busy }}>
      {children}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => sheet.mode && process(e.target.files?.[0], sheet.mode)} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => sheet.mode && process(e.target.files?.[0], sheet.mode)} />

      <Sheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-left font-headline">
              <ScanLine className="h-5 w-5 text-primary" /> Escanear comprobante
            </SheetTitle>
            <SheetDescription className="text-left">
              {chosen ? (
                <>
                  Es <strong>{chosen.label.toLowerCase()}</strong>. Sacá la foto y la IA completa los datos.
                </>
              ) : (
                '¿Qué es lo que vas a escanear? La IA lee los datos, vos decidís qué es.'
              )}
            </SheetDescription>
          </SheetHeader>

          {!sheet.mode ? (
            <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-label="Tipo de comprobante">
              {modes.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSheet((s) => ({ ...s, mode: m.value }))}
                  className="flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition-colors hover:border-primary hover:bg-secondary/50"
                >
                  <m.icon className={cn('h-6 w-6', m.className)} />
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.hint}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-primary/40 bg-secondary/50 p-5 font-semibold transition-colors hover:bg-secondary">
                  <Camera className="h-7 w-7 text-primary" /> Sacar foto
                </button>
                <button onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border p-5 font-semibold transition-colors hover:bg-muted">
                  <ImagePlus className="h-7 w-7 text-primary" /> Elegir de la galería
                </button>
              </div>
              <button onClick={() => setSheet((s) => ({ ...s, mode: null }))} className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" /> Cambiar tipo
              </button>
              <p className="mt-2 text-xs text-muted-foreground">Consejo: buena luz, el papel entero en la foto y sin sombras.</p>
            </>
          )}
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
