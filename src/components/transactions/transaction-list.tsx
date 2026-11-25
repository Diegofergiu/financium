'use client';

import { useMemo } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Repeat, Ticket } from 'lucide-react';
import { AttachmentBadge } from '@/components/shared/attachment-picker';
import { useWallet } from '@/components/providers/wallet-provider';
import { useTransactionDialog } from './transaction-dialog';
import { CategoryDot, Money } from '@/components/shared/ui-bits';
import { capitalize, formatDate, todayISO } from '@/lib/format';
import { format, subDays } from 'date-fns';
import type { Transaction } from '@/types';
import { cn } from '@/lib/utils';

function dayLabel(date: string) {
  const today = todayISO();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  if (date === today) return 'Hoy';
  if (date === yesterday) return 'Ayer';
  return capitalize(formatDate(date, "EEEE d 'de' MMMM"));
}

export function TransactionRow({ t }: { t: Transaction }) {
  const { categories, currency, accounts, defaultAccountId } = useWallet();
  const { openTransaction } = useTransactionDialog();
  const cat = categories.find((c) => c.id === t.categoryId);
  const isIncome = t.type === 'income';
  const isTransfer = t.type === 'transfer';
  const acc = accounts.find((a) => a.id === (t.accountId || defaultAccountId));
  const toAcc = accounts.find((a) => a.id === t.toAccountId);
  const txCurrency = acc?.currency || currency;
  const color = isTransfer ? '#64748b' : cat?.colorHex ?? '#a8a29e';

  return (
    <button
      onClick={() => openTransaction({ transaction: t })}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/60 sm:px-3"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1f`, color }}>
        {isTransfer ? (
          <ArrowLeftRight className="h-5 w-5" />
        ) : t.checkId ? (
          <Ticket className="h-5 w-5" />
        ) : t.recurringId ? (
          <Repeat className="h-5 w-5" />
        ) : isIncome ? (
          <ArrowDownLeft className="h-5 w-5" />
        ) : (
          <ArrowUpRight className="h-5 w-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[15px] font-semibold">{t.description}</span>
          <AttachmentBadge count={t.attachments?.length} />
        </span>
        <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {isTransfer ? (
            <>
              {acc?.name ?? 'Cuenta'} → {toAcc?.name ?? 'Cuenta'}
            </>
          ) : (
            <>
              <CategoryDot color={cat?.colorHex} className="h-2 w-2" />
              {cat?.name ?? 'Sin categoría'}
              {accounts.length > 1 && acc ? <span>· {acc.name}</span> : t.paymentMethod ? <span className="hidden sm:inline">· {t.paymentMethod}</span> : null}
            </>
          )}
        </span>
      </span>
      {isTransfer ? (
        <Money amount={t.amount} currency={txCurrency} className="text-[15px] text-muted-foreground" />
      ) : (
        <Money amount={t.amount} currency={txCurrency} type={t.type as 'income' | 'expense'} signed className={cn('text-[15px]', isIncome && 'text-income')} />
      )}
    </button>
  );
}

/** Lista agrupada por día. */
export function TransactionList({ transactions, grouped = true }: { transactions: Transaction[]; grouped?: boolean }) {
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const k = t.date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return Array.from(map.entries());
  }, [transactions]);

  if (!grouped) {
    return (
      <div className="space-y-0.5">
        {transactions.map((t) => (
          <TransactionRow key={t.id} t={t} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([date, items]) => (
        <section key={date}>
          <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-3">{dayLabel(date)}</h3>
          <div className="space-y-0.5">
            {items.map((t) => (
              <TransactionRow key={t.id} t={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
