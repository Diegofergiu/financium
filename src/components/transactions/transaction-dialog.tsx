'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CategoryDot, ConfirmDialog, Segmented } from '@/components/shared/ui-bits';
import { Camera, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PAYMENT_METHODS } from '@/lib/defaults';
import { parseAmount, todayISO, formatMoney } from '@/lib/format';
import { guessCategory } from '@/lib/auto-category';
import { suggestTransactionCategory } from '@/ai/flows/suggest-transaction-category';
import { extractReceiptData } from '@/ai/flows/extract-receipt-data';
import type { Transaction, TransactionType } from '@/types';

interface OpenOptions {
  type?: TransactionType;
  transaction?: Transaction;
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

/** Reduce una foto a máx. 1280px y la devuelve como data URI JPEG (para enviarla a la IA). */
async function fileToDataUri(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function TransactionDialog({ open, onOpenChange, type: initialType, transaction }: OpenOptions & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { activeWallet, categories, authFields, currency } = useWallet();
  const isEdit = !!transaction;

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [touchedCategory, setTouchedCategory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reiniciar el formulario cada vez que se abre
  useEffect(() => {
    if (!open) return;
    setType(transaction?.type ?? initialType ?? 'expense');
    setAmount(transaction ? String(transaction.amount).replace('.', ',') : '');
    setDescription(transaction?.description ?? '');
    setCategoryId(transaction?.categoryId ?? '');
    setDate(transaction?.date ?? todayISO());
    setPaymentMethod(transaction?.paymentMethod ?? 'Efectivo');
    setNotes(transaction?.notes ?? '');
    setTouchedCategory(!!transaction);
  }, [open, transaction, initialType]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => !c.kind || c.kind === 'both' || c.kind === type || c.id === categoryId),
    [categories, type, categoryId]
  );

  // Sugerencia automática instantánea (sin IA) mientras se escribe
  useEffect(() => {
    if (touchedCategory || !description) return;
    const guess = guessCategory(description, visibleCategories);
    if (guess) setCategoryId(guess.id);
  }, [description, visibleCategories, touchedCategory]);

  const parsedAmount = parseAmount(amount);

  const onSuggest = async () => {
    if (!description.trim()) {
      toast({ title: 'Primero escribí una descripción' });
      return;
    }
    setSuggesting(true);
    try {
      const local = guessCategory(description, visibleCategories);
      let found = local;
      if (!found && visibleCategories.length) {
        const result = await suggestTransactionCategory({
          transactionDescription: description,
          availableCategories: visibleCategories.map((c) => c.name),
        });
        found = visibleCategories.find((c) => c.name.toLowerCase() === result?.suggestedCategory?.toLowerCase()) ?? null;
      }
      if (found) {
        setCategoryId(found.id);
        setTouchedCategory(true);
        toast({ title: `Categoría sugerida: ${found.name}` });
      } else {
        toast({ title: 'No encontramos una categoría clara', description: 'Elegila de la lista.' });
      }
    } catch {
      toast({ title: 'La sugerencia con IA no está disponible', description: 'Elegí la categoría de la lista.' });
    } finally {
      setSuggesting(false);
    }
  };

  const onScan = async (file?: File) => {
    if (!file) return;
    setScanning(true);
    try {
      const dataUri = await fileToDataUri(file);
      const r = await extractReceiptData({ imageDataUri: dataUri });
      if (r.amount) setAmount(String(r.amount).replace('.', ','));
      if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) setDate(r.date);
      const desc = [r.vendorOrPayer, r.description].filter(Boolean).join(' – ');
      if (desc) setDescription(desc);
      toast({ title: 'Comprobante leído', description: 'Revisá los datos antes de guardar.' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo leer el comprobante', description: 'La lectura con IA requiere configurar GEMINI_API_KEY. Podés cargar los datos a mano.' });
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !authFields) return;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ variant: 'destructive', title: 'Revisá el monto', description: 'Tiene que ser un número mayor a cero.' });
      return;
    }
    if (!description.trim()) {
      toast({ variant: 'destructive', title: 'Falta la descripción' });
      return;
    }
    setSaving(true);
    const data = {
      type,
      amount: Math.round(parsedAmount * 100) / 100,
      description: description.trim(),
      categoryId,
      date,
      paymentMethod,
      notes: notes.trim(),
    };
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'wallets', activeWallet.id, 'transactions', transaction!.id), { ...data, updatedAt: serverTimestamp() });
        toast({ title: 'Movimiento actualizado' });
      } else {
        await addDoc(collection(db, 'wallets', activeWallet.id, 'transactions'), {
          ...data,
          walletId: activeWallet.id,
          ...authFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: type === 'income' ? 'Ingreso anotado' : 'Gasto anotado', description: `${formatMoney(data.amount, currency)} · ${data.description}` });
      }
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
    try {
      await deleteDoc(doc(db, 'wallets', activeWallet.id, 'transactions', transaction.id));
      toast({ title: 'Movimiento eliminado' });
      setConfirmDelete(false);
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo eliminar' });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</DialogTitle>
            <DialogDescription>
              En <strong>{activeWallet?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <Segmented
              value={type}
              onChange={(v) => setType(v)}
              options={[
                { value: 'expense', label: 'Gasto', activeClass: 'text-expense' },
                { value: 'income', label: 'Ingreso', activeClass: 'text-income' },
              ]}
            />

            <div className="space-y-2">
              <Label htmlFor="tx-amount">Monto</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl font-semibold text-muted-foreground">$</span>
                <Input
                  id="tx-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  className="tabular h-14 pl-9 text-2xl font-bold md:text-2xl"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                  autoFocus={!isEdit}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tx-desc">Descripción</Label>
                {!isEdit && (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={scanning} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                    {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    Leer ticket con foto
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onScan(e.target.files?.[0])} />
              </div>
              <Input id="tx-desc" placeholder={type === 'income' ? 'Ej.: Sueldo de marzo' : 'Ej.: Supermercado Coto'} className="h-11" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Categoría</Label>
                <button type="button" onClick={onSuggest} disabled={suggesting} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                  {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Sugerir
                </button>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tx-date">Fecha</Label>
                <Input id="tx-date" type="date" className="h-11" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Medio de pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([...PAYMENT_METHODS, paymentMethod].filter(Boolean))).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-notes">
                Nota <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea id="tx-notes" rows={2} placeholder="Algo para recordar…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <DialogFooter className="gap-2 pt-2">
              {isEdit && (
                <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Eliminar
                </Button>
              )}
              <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {isEdit ? 'Guardar cambios' : type === 'income' ? 'Anotar ingreso' : 'Anotar gasto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar este movimiento?"
        description="Esta acción no se puede deshacer."
        onConfirm={onDelete}
      />
    </>
  );
}
