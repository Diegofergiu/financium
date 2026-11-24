'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Segmented } from '@/components/shared/ui-bits';
import { AttachmentPicker, useAttachmentDraft } from '@/components/shared/attachment-picker';
import { deleteWithUndo } from '@/components/shared/undo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { deleteAttachments } from '@/lib/attachments';
import { OFFLINE_NOTE, safeWrite } from '@/lib/write';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BANKS } from '@/lib/defaults';
import { parseAmount, todayISO } from '@/lib/format';
import type { Check, CheckStatus, CheckType } from '@/types';

export function CheckDialog({ open, onOpenChange, check, defaultType = 'toCollect' }: { open: boolean; onOpenChange: (o: boolean) => void; check?: Check | null; defaultType?: CheckType }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { activeWallet, authFields, accounts, defaultAccountId, currency } = useWallet();
  const isEdit = !!check;
  const draft = useAttachmentDraft();
  const saved = useRef(false);
  const [accountId, setAccountId] = useState('');

  const [type, setType] = useState<CheckType>(defaultType);
  const [checkNumber, setCheckNumber] = useState('');
  const [bank, setBank] = useState('');
  const [party, setParty] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(check?.type ?? defaultType);
    setCheckNumber(check?.checkNumber ?? '');
    setBank(check?.bank ?? '');
    setParty(check?.issuerRecipient ?? '');
    setDueDate(check?.dueDate ?? todayISO());
    setAmount(check ? String(check.amount).replace('.', ',') : '');
    setNotes(check?.notes ?? '');
    setAccountId(check?.accountId || defaultAccountId || '');
    saved.current = false;
    draft.reset(check?.attachments ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, check, defaultType]);

  const handleOpenChange = (o: boolean) => {
    if (!o && !saved.current) draft.discard();
    onOpenChange(o);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !authFields) return;
    const value = parseAmount(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ variant: 'destructive', title: 'Revisá el monto' });
      return;
    }
    setSaving(true);
    const data = {
      type,
      checkNumber: checkNumber.trim(),
      bank: bank.trim(),
      issuerRecipient: party.trim(),
      dueDate,
      amount: Math.round(value * 100) / 100,
      notes: notes.trim(),
      accountId: accountId || defaultAccountId || '',
      attachments: draft.items,
    };
    try {
      let result: 'ok' | 'queued';
      if (isEdit) {
        result = await safeWrite(updateDoc(doc(db, 'wallets', activeWallet.id, 'checks', check!.id), { ...data, updatedAt: serverTimestamp() }));
        toast({ title: 'Cheque actualizado', description: result === 'queued' ? OFFLINE_NOTE : undefined });
      } else {
        result = await safeWrite(setDoc(doc(collection(db, 'wallets', activeWallet.id, 'checks')), {
          ...data,
          walletId: activeWallet.id,
          status: 'pending',
          isCleared: false,
          clearedAt: null,
          transactionId: null,
          ...authFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }));
        toast({ title: 'Cheque registrado', description: result === 'queued' ? OFFLINE_NOTE : 'Te avisaremos antes del vencimiento.' });
      }
      saved.current = true;
      draft.commit();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'No se pudo guardar el cheque' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar cheque' : 'Nuevo cheque'}</DialogTitle>
          <DialogDescription>
            {type === 'toCollect' ? 'Un cheque que te dieron y vas a cobrar.' : 'Un cheque que entregaste y vas a pagar.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: 'toCollect', label: 'A cobrar', activeClass: 'text-income' },
              { value: 'issued', label: 'A pagar', activeClass: 'text-expense' },
            ]}
          />
          <div className="space-y-2">
            <Label htmlFor="ck-amount">Monto</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl font-semibold text-muted-foreground">$</span>
              <Input id="ck-amount" inputMode="decimal" placeholder="0,00" className="tabular h-14 pl-9 text-2xl font-bold md:text-2xl" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ck-party">{type === 'toCollect' ? '¿Quién te lo dio?' : '¿A quién se lo diste?'}</Label>
            <Input id="ck-party" placeholder="Nombre o empresa" className="h-11" value={party} onChange={(e) => setParty(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ck-due">Fecha de cobro</Label>
              <Input id="ck-due" type="date" className="h-11" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ck-number">N° de cheque</Label>
              <Input id="ck-number" inputMode="numeric" placeholder="Opcional" className="h-11" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ck-bank">Banco</Label>
            <Input id="ck-bank" list="banks-list" placeholder="Ej.: Banco Nación" className="h-11" value={bank} onChange={(e) => setBank(e.target.value)} />
            <datalist id="banks-list">
              {BANKS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ck-notes">
              Nota <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea id="ck-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {accounts.length > 1 && (
            <div className="space-y-2">
              <Label>{type === 'toCollect' ? 'Cuenta donde se deposita' : 'Cuenta de la que sale'}</Label>
              <Select value={accountId || defaultAccountId || undefined} onValueChange={setAccountId}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => !a.archived && a.currency === currency)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {activeWallet && <AttachmentPicker walletId={activeWallet.id} draft={draft} label="Foto del cheque (frente y dorso)" />}
          <DialogFooter className="pt-2">
            <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Registrar cheque'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Acciones sobre cheques: cobrar/pagar (genera el movimiento), rechazar, anular, volver a pendiente, eliminar. */
export function useCheckActions() {
  const db = useFirestore();
  const { toast } = useToast();
  const { activeWallet, authFields, categories, defaultAccountId, transactions } = useWallet();

  const setStatus = useCallback(
    async (check: Check, status: CheckStatus) => {
      if (!activeWallet || !authFields) return;
      const wid = activeWallet.id;
      const checkRef = doc(db, 'wallets', wid, 'checks', check.id);
      const batch = writeBatch(db);
      try {
        if (status === 'cleared') {
          // Registrar automáticamente el movimiento para que el saldo quede al día
          const isIncome = check.type === 'toCollect';
          const cat =
            categories.find((c) => c.name.toLowerCase() === (isIncome ? 'ventas' : 'varios')) ??
            categories.find((c) => c.kind === (isIncome ? 'income' : 'expense')) ??
            categories[0];
          const txRef = doc(collection(db, 'wallets', wid, 'transactions'));
          batch.set(txRef, {
            walletId: wid,
            type: isIncome ? 'income' : 'expense',
            amount: check.amount,
            description: `Cheque${check.checkNumber ? ` N° ${check.checkNumber}` : ''} – ${check.issuerRecipient}`,
            categoryId: cat?.id ?? '',
            date: todayISO(),
            paymentMethod: 'Cheque',
            notes: check.bank ? `Banco: ${check.bank}` : '',
            checkId: check.id,
            accountId: check.accountId || defaultAccountId || '',
            ...authFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.update(checkRef, { status, isCleared: true, clearedAt: todayISO(), transactionId: txRef.id, updatedAt: serverTimestamp() });
        } else {
          if (check.transactionId) batch.delete(doc(db, 'wallets', wid, 'transactions', check.transactionId));
          batch.update(checkRef, { status, isCleared: false, clearedAt: null, transactionId: null, updatedAt: serverTimestamp() });
        }
        await safeWrite(batch.commit(), 'No se pudo actualizar el cheque');
        const msg: Record<CheckStatus, string> = {
          cleared: check.type === 'toCollect' ? 'Cheque cobrado y anotado como ingreso' : 'Cheque pagado y anotado como gasto',
          pending: 'Cheque marcado como pendiente',
          rejected: 'Cheque marcado como rechazado',
          cancelled: 'Cheque anulado',
        };
        toast({ title: msg[status] });
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'No se pudo actualizar el cheque' });
      }
    },
    [db, activeWallet, authFields, categories, defaultAccountId, toast]
  );

  const remove = useCallback(
    async (check: Check) => {
      if (!activeWallet) return;
      const wid = activeWallet.id;
      const items: { ref: ReturnType<typeof doc>; data: Record<string, any> }[] = [{ ref: doc(db, 'wallets', wid, 'checks', check.id), data: check }];
      const tx = check.transactionId ? transactions.find((t) => t.id === check.transactionId) : null;
      if (tx) items.push({ ref: doc(db, 'wallets', wid, 'transactions', tx.id), data: tx });
      try {
        await deleteWithUndo(db, items, 'Cheque eliminado', () => deleteAttachments(check.attachments ?? []));
      } catch {
        toast({ variant: 'destructive', title: 'No se pudo eliminar el cheque' });
      }
    },
    [db, activeWallet, transactions, toast]
  );

  return { setStatus, remove };
}
