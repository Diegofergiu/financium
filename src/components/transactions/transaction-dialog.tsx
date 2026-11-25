'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CategoryDot, Segmented } from '@/components/shared/ui-bits';
import { AttachmentPicker, useAttachmentDraft } from '@/components/shared/attachment-picker';
import { deleteWithUndo } from '@/components/shared/undo';
import { ArrowRight, Camera, Loader2, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PAYMENT_METHODS } from '@/lib/defaults';
import { parseAmount, todayISO, formatMoney, amountToInput } from '@/lib/format';
import { guessCategory } from '@/lib/auto-category';
import { deleteAttachments, uploadAttachment } from '@/lib/attachments';
import { OFFLINE_NOTE, safeWrite } from '@/lib/write';
import { aiErrorMessage, scanDocument, suggestCategoryAI, type ScanResult } from '@/lib/ai';
import { useFirebaseApp } from '@/firebase';
import type { Attachment, Transaction, TransactionType } from '@/types';

export interface TxPrefill {
  type?: 'income' | 'expense';
  amount?: number;
  description?: string;
  categoryId?: string;
  date?: string;
  notes?: string;
  attachments?: Attachment[];
  /** Si viene de la IA: texto a mostrar para que la persona revise. */
  aiNote?: string;
}

interface OpenOptions {
  type?: TransactionType;
  transaction?: Transaction;
  prefill?: TxPrefill;
}

const Ctx = createContext<{ openTransaction: (opts?: OpenOptions) => void }>({ openTransaction: () => {} });
export const useTransactionDialog = () => useContext(Ctx);

export function TransactionDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; opts: OpenOptions }>({ open: false, opts: {} });
  const openTransaction = useCallback((opts: OpenOptions = {}) => setState({ open: true, opts }), []);
  return (
    <Ctx.Provider value={{ openTransaction }}>
      {children}
      <TransactionDialog open={state.open} onOpenChange={(open) => setState((s) => ({ ...s, open }))} {...state.opts} />
    </Ctx.Provider>
  );
}

const amountClean = (v: string) => v.replace(/[^\d.,]/g, '');

function TransactionDialog({ open, onOpenChange, type: initialType, transaction, prefill }: OpenOptions & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const app = useFirebaseApp();
  const [aiNote, setAiNote] = useState<string | null>(null);
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWallet, categories, authFields, currency, accounts, defaultAccountId, canEdit } = useWallet();
  const isEdit = !!transaction;
  const readOnly = !canEdit;
  const draft = useAttachmentDraft();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [touchedCategory, setTouchedCategory] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const saved = useRef(false);

  const activeAccounts = accounts.filter((a) => !a.archived || a.id === transaction?.accountId || a.id === transaction?.toAccountId);
  const fromAcc = accounts.find((a) => a.id === (accountId || defaultAccountId));
  const toAcc = accounts.find((a) => a.id === toAccountId);
  const crossCurrency = type === 'transfer' && !!fromAcc && !!toAcc && fromAcc.currency !== toAcc.currency;
  const amountCurrency = fromAcc?.currency || currency;

  useEffect(() => {
    if (!open) return;
    saved.current = false;
    setType(transaction?.type ?? prefill?.type ?? initialType ?? 'expense');
    setAmount(transaction ? amountToInput(transaction.amount) : prefill?.amount ? amountToInput(prefill.amount) : '');
    setToAmount(transaction?.toAmount ? amountToInput(transaction.toAmount) : '');
    setDescription(transaction?.description ?? prefill?.description ?? '');
    setCategoryId(transaction?.categoryId ?? prefill?.categoryId ?? '');
    setAccountId(transaction?.accountId || defaultAccountId || '');
    setToAccountId(transaction?.toAccountId ?? '');
    setDate(transaction?.date ?? prefill?.date ?? todayISO());
    setPaymentMethod(transaction?.paymentMethod ?? 'Efectivo');
    setNotes(transaction?.notes ?? prefill?.notes ?? '');
    setTouchedCategory(!!transaction || !!prefill?.categoryId);
    setAiNote(prefill?.aiNote ?? null);
    draft.reset(transaction?.attachments ?? [], prefill?.attachments ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction, initialType, prefill]);

  const handleOpenChange = (o: boolean) => {
    if (!o && !saved.current) draft.discard();
    onOpenChange(o);
  };

  const visibleCategories = useMemo(
    () => categories.filter((c) => !c.kind || c.kind === 'both' || c.kind === type || c.id === categoryId),
    [categories, type, categoryId]
  );

  useEffect(() => {
    if (touchedCategory || !description || type === 'transfer') return;
    const guess = guessCategory(description, visibleCategories);
    if (guess) setCategoryId(guess.id);
  }, [description, visibleCategories, touchedCategory, type]);

  const parsedAmount = parseAmount(amount);

  const onSuggest = async () => {
    if (!description.trim()) {
      toast({ title: 'Primero escribí una descripción' });
      return;
    }
    setSuggesting(true);
    try {
      let found = guessCategory(description, visibleCategories);
      if (!found && visibleCategories.length) {
        const name = await suggestCategoryAI(app, description, visibleCategories.map((c) => c.name));
        found = visibleCategories.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;
      }
      if (found) {
        setCategoryId(found.id);
        setTouchedCategory(true);
        toast({ title: `Categoría sugerida: ${found.name}` });
      } else toast({ title: 'No encontramos una categoría clara', description: 'Elegila de la lista.' });
    } catch (e) {
      toast({ title: 'La sugerencia con IA no está disponible', description: aiErrorMessage(e) });
    } finally {
      setSuggesting(false);
    }
  };

  /** Lee el comprobante con IA, completa el formulario y deja la foto adjunta. */
  const onScan = async (file?: File) => {
    if (!file || !activeWallet || !user) return;
    setScanning(true);
    let attachment: Attachment | null = null;
    try {
      if (navigator.onLine) attachment = await uploadAttachment(activeWallet.id, user.uid, file);
    } catch {
      /* el adjunto es opcional */
    }
    try {
      const r: ScanResult = await scanDocument(app, file, { categories: categories.map((c) => c.name), walletName: activeWallet.name });
      if (r.kind === 'check') {
        // Es un cheque: se pasa al formulario de cheques
        window.dispatchEvent(new CustomEvent('mibolsillo:scanned-check', { detail: { result: r, attachment } }));
        saved.current = true;
        draft.discard();
        onOpenChange(false);
        return;
      }
      if (attachment) draft.add(attachment);
      if (r.direction === 'income' || r.direction === 'expense') setType(r.direction);
      if (r.amount) setAmount(amountToInput(r.amount));
      if (r.date) setDate(r.date);
      if (r.description || r.counterparty) setDescription(r.description || r.counterparty);
      const cat = categories.find((c) => c.name === r.category);
      if (cat) {
        setCategoryId(cat.id);
        setTouchedCategory(true);
      }
      setAiNote(r.notes || 'Completado con IA: revisá los datos antes de guardar.');
    } catch (e) {
      if (attachment) draft.add(attachment);
      toast({ variant: 'destructive', title: 'No se pudo leer con IA', description: `${aiErrorMessage(e)}${attachment ? ' La foto quedó adjunta.' : ''}` });
    } finally {
      setScanning(false);
      if (scanRef.current) scanRef.current.value = '';
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !authFields || readOnly) return;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ variant: 'destructive', title: 'Revisá el monto', description: 'Tiene que ser un número mayor a cero.' });
      return;
    }
    if (type === 'transfer') {
      if (!toAccountId || toAccountId === (accountId || defaultAccountId)) {
        toast({ variant: 'destructive', title: 'Elegí la cuenta de destino', description: 'Tiene que ser distinta a la de origen.' });
        return;
      }
    } else if (!description.trim()) {
      toast({ variant: 'destructive', title: 'Falta la descripción' });
      return;
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    const parsedTo = parseAmount(toAmount);
    const data: Record<string, any> = {
      type,
      amount: round(parsedAmount),
      description: description.trim() || (type === 'transfer' ? `${fromAcc?.name ?? 'Cuenta'} → ${toAcc?.name ?? 'Cuenta'}` : ''),
      categoryId: type === 'transfer' ? '' : categoryId,
      accountId: accountId || defaultAccountId || '',
      toAccountId: type === 'transfer' ? toAccountId : '',
      toAmount: crossCurrency && Number.isFinite(parsedTo) && parsedTo > 0 ? round(parsedTo) : null,
      date,
      paymentMethod: type === 'transfer' ? '' : paymentMethod,
      notes: notes.trim(),
      attachments: draft.items,
    };
    if (crossCurrency && !data.toAmount) {
      toast({ variant: 'destructive', title: `Indicá cuánto entró en ${toAcc?.currency}` });
      return;
    }
    setSaving(true);
    try {
      const ref = isEdit ? doc(db, 'wallets', activeWallet.id, 'transactions', transaction!.id) : doc(collection(db, 'wallets', activeWallet.id, 'transactions'));
      const p = isEdit
        ? updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
        : setDoc(ref, { ...data, walletId: activeWallet.id, ...authFields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const result = await safeWrite(p);
      saved.current = true;
      draft.commit();
      const label = type === 'income' ? 'Ingreso anotado' : type === 'expense' ? 'Gasto anotado' : 'Transferencia anotada';
      toast({
        title: isEdit ? 'Movimiento actualizado' : label,
        description: result === 'queued' ? OFFLINE_NOTE : `${formatMoney(data.amount, amountCurrency)} · ${data.description}`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'No se pudo guardar', description: 'Revisá tu conexión e intentá de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!activeWallet || !transaction) return;
    saved.current = true;
    draft.discard();
    onOpenChange(false);
    const ref = doc(db, 'wallets', activeWallet.id, 'transactions', transaction.id);
    await deleteWithUndo(db, [{ ref, data: transaction }], 'Movimiento eliminado', () => deleteAttachments(transaction.attachments ?? []));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{readOnly ? 'Detalle del movimiento' : isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</DialogTitle>
          <DialogDescription>
            En <strong>{activeWallet?.name}</strong>
            {readOnly && ' · sólo lectura'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {aiNote && (
            <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-secondary/60 p-3 text-sm">
              <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>Completado con IA.</strong> {aiNote === 'Completado con IA: revisá los datos antes de guardar.' ? 'Revisá los datos antes de guardar.' : aiNote}
              </span>
            </div>
          )}
          <fieldset disabled={readOnly} className="space-y-4">
            <Segmented
              value={type}
              onChange={(v) => setType(v)}
              options={[
                { value: 'expense', label: 'Gasto', activeClass: 'text-expense' },
                { value: 'income', label: 'Ingreso', activeClass: 'text-income' },
                ...(accounts.length > 1 || type === 'transfer' ? [{ value: 'transfer' as const, label: 'Transferir' }] : []),
              ]}
            />

            <div className="space-y-2">
              <Label htmlFor="tx-amount">{crossCurrency ? `Monto que sale (${amountCurrency})` : 'Monto'}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl font-semibold text-muted-foreground">$</span>
                <Input
                  id="tx-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  className="tabular h-14 pl-9 text-2xl font-bold md:text-2xl"
                  value={amount}
                  onChange={(e) => setAmount(amountClean(e.target.value))}
                  autoFocus={!isEdit}
                  required
                />
              </div>
            </div>

            {type === 'transfer' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <div className="space-y-2">
                    <Label>Desde</Label>
                    <Select value={accountId || defaultAccountId || undefined} onValueChange={setAccountId}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                            {a.currency !== currency ? ` (${a.currency})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ArrowRight className="mb-3 h-5 w-5 text-muted-foreground" />
                  <div className="space-y-2">
                    <Label>Hacia</Label>
                    <Select value={toAccountId || undefined} onValueChange={setToAccountId}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Elegir" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAccounts
                          .filter((a) => a.id !== (accountId || defaultAccountId))
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                              {a.currency !== currency ? ` (${a.currency})` : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {crossCurrency && (
                  <div className="space-y-2">
                    <Label htmlFor="tx-to-amount">Monto que entra ({toAcc?.currency})</Label>
                    <Input id="tx-to-amount" inputMode="decimal" className="tabular h-11" placeholder="0,00" value={toAmount} onChange={(e) => setToAmount(amountClean(e.target.value))} />
                    {Number.isFinite(parsedAmount) && parseAmount(toAmount) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Cotización: 1 {toAcc?.currency} = {formatMoney(parsedAmount / parseAmount(toAmount), fromAcc?.currency)}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="tx-desc">
                    Detalle <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input id="tx-desc" placeholder="Ej.: Extracción del cajero" className="h-11" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="tx-desc">Descripción</Label>
                    {!isEdit && !readOnly && (
                      <button type="button" onClick={() => scanRef.current?.click()} disabled={scanning} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                        {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                        {scanning ? 'Leyendo…' : 'Completar con foto (IA)'}
                      </button>
                    )}
                    <input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onScan(e.target.files?.[0])} />
                  </div>
                  <Input id="tx-desc" placeholder={type === 'income' ? 'Ej.: Sueldo de marzo' : 'Ej.: Supermercado Coto'} className="h-11" value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Categoría</Label>
                    {!readOnly && (
                      <button type="button" onClick={onSuggest} disabled={suggesting} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                        {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Sugerir
                      </button>
                    )}
                  </div>
                  <Select
                    value={categoryId || undefined}
                    onValueChange={(v) => {
                      setCategoryId(v);
                      setTouchedCategory(true);
                    }}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Elegí una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <CategoryDot color={c.colorHex} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tx-date">Fecha</Label>
                <Input id="tx-date" type="date" className="h-11" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              {type !== 'transfer' &&
                (accounts.length > 1 ? (
                  <div className="space-y-2">
                    <Label>Cuenta</Label>
                    <Select value={accountId || defaultAccountId || undefined} onValueChange={setAccountId}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                            {a.currency !== currency ? ` (${a.currency})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <PaymentSelect value={paymentMethod} onChange={setPaymentMethod} />
                ))}
            </div>
            {type !== 'transfer' && accounts.length > 1 && <PaymentSelect value={paymentMethod} onChange={setPaymentMethod} />}

            <div className="space-y-2">
              <Label htmlFor="tx-notes">
                Nota <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea id="tx-notes" rows={2} placeholder="Algo para recordar…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </fieldset>

          {activeWallet && (readOnly ? draft.items.length > 0 : true) && (
            <AttachmentPicker walletId={activeWallet.id} draft={draft} disabled={readOnly} label={type === 'transfer' ? 'Comprobante' : 'Foto de la factura o boleta'} />
          )}

          {!readOnly && (
            <DialogFooter className="gap-2 pt-2">
              {isEdit && (
                <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto" onClick={onDelete}>
                  <Trash2 /> Eliminar
                </Button>
              )}
              <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {isEdit ? 'Guardar cambios' : type === 'income' ? 'Anotar ingreso' : type === 'expense' ? 'Anotar gasto' : 'Anotar transferencia'}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Medio de pago</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from(new Set([...PAYMENT_METHODS, value].filter(Boolean))).map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
