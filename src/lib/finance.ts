import type { Account, Transaction } from '@/types';

export const ACCOUNT_KINDS: { value: Account['kind']; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'bank', label: 'Cuenta bancaria' },
  { value: 'wallet', label: 'Billetera virtual' },
  { value: 'savings', label: 'Ahorros' },
  { value: 'card', label: 'Tarjeta de crédito' },
];

export const DEFAULT_ACCOUNTS: Omit<Account, 'id' | 'currency'>[] = [
  { name: 'Efectivo', kind: 'cash', initialBalance: 0, colorHex: '#16a34a', order: 0 },
  { name: 'Banco', kind: 'bank', initialBalance: 0, colorHex: '#3b82f6', order: 1 },
];

/** Cuenta efectiva de un movimiento (los movimientos viejos sin cuenta van a la principal). */
export function accountIdOf(t: { accountId?: string }, defaultAccountId: string | null) {
  return t.accountId || defaultAccountId || '';
}

/**
 * Movimientos que cuentan para ingresos/gastos del libro: sin transferencias y
 * sólo de cuentas en la moneda del libro (los ahorros en dólares se muestran aparte).
 */
export function bookTransactions(transactions: Transaction[], accounts: Account[], defaultAccountId: string | null, bookCurrency: string) {
  const foreign = new Set(accounts.filter((a) => a.currency && a.currency !== bookCurrency).map((a) => a.id));
  return transactions.filter((t) => t.type !== 'transfer' && !foreign.has(accountIdOf(t, defaultAccountId)));
}

/** Saldo de cada cuenta = saldo inicial + ingresos − gastos ± transferencias. */
export function accountBalances(accounts: Account[], transactions: Transaction[], defaultAccountId: string | null) {
  const map = new Map<string, number>(accounts.map((a) => [a.id, Number(a.initialBalance) || 0]));
  const add = (id: string, v: number) => map.has(id) && map.set(id, (map.get(id) ?? 0) + v);
  for (const t of transactions) {
    const v = Number(t.amount) || 0;
    const from = accountIdOf(t, defaultAccountId);
    if (t.type === 'income') add(from, v);
    else if (t.type === 'expense') add(from, -v);
    else if (t.type === 'transfer') {
      add(from, -v);
      if (t.toAccountId) add(t.toAccountId, Number(t.toAmount) || v);
    }
  }
  return map;
}
