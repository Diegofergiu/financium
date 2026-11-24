'use client';

import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { format } from 'date-fns';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/format';
import { recurringTransactionId } from '@/lib/recurring';
import { OFFLINE_NOTE, safeWrite } from '@/lib/write';
import type { Recurring } from '@/types';

/** Anota ahora el gasto fijo de este mes (para los que no se anotan solos). */
export function useMarkRecurringPaid() {
  const db = useFirestore();
  const { toast } = useToast();
  const { activeWallet, authFields, currency } = useWallet();
  return async (r: Recurring) => {
    if (!activeWallet || !authFields) return;
    const month = format(new Date(), 'yyyy-MM');
    const batch = writeBatch(db);
    batch.set(doc(db, 'wallets', activeWallet.id, 'transactions', recurringTransactionId(r.id, month)), {
      walletId: activeWallet.id,
      type: r.type,
      amount: r.amount,
      description: r.description,
      categoryId: r.categoryId,
      accountId: r.accountId ?? '',
      paymentMethod: r.paymentMethod ?? '',
      notes: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      recurringId: r.id,
      ...authFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'wallets', activeWallet.id, 'recurring', r.id), { lastCreatedMonth: month, updatedAt: serverTimestamp() });
    const res = await safeWrite(batch.commit());
    toast({ title: `${r.description} anotado`, description: res === 'queued' ? OFFLINE_NOTE : formatMoney(r.amount, currency) });
  };
}

